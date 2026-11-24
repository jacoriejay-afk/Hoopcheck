import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MediaPostComposer } from "../../components/MediaPostComposer";
import { Skeleton } from "../../components/Motion";
import { supabase } from "../../src/lib/supabase";
import { useNetwork, requireOnline } from "../../src/native/network";
import { useNativeAccount } from "../../src/native/useNativeAccount";
import { REEL_TOPICS, type ReelTopic } from "../../src/native/mediaClient";
import { clearReelCaptionDraft, readReelCaptionDraft, writeReelCaptionDraft } from "../../src/native/reelDraft";
import { GlassThemeScope, useEntryTheme } from "../../src/theme";
import { HOOPREELS_CREATE_ENABLED } from "../../../../lib/hoopreels-video-source";

type OwnReel = { id: string; body: string | null; created_at: string; status: string };
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export default function HoopReelsStudioRoute() {
  return <GlassThemeScope>{HOOPREELS_CREATE_ENABLED ? <HoopReelsStudio /> : <CreationPaused />}</GlassThemeScope>;
}
function CreationPaused() {
  const router = useRouter();
  const theme = useEntryTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: 24, gap: 16, justifyContent: "center" }}>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 24, fontWeight: "800" }}>Reel creation is not available yet</Text>
    <Text style={{ color: theme.muted }}>HoopReels is preparing its streaming and safety systems. Existing HoopFeed posting remains available according to your membership.</Text>
    <Pressable accessibilityRole="button" onPress={() => router.replace("/reels")} style={{ minHeight: 48 }}><Text style={{ color: theme.accent }}>Back to Reels</Text></Pressable>
  </SafeAreaView>;
}
function HoopReelsStudio() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { account, loading, error: accountError, retry } = useNativeAccount();
  const { offline } = useNetwork();
  const owner = account?.user.id;
  const allowed = Boolean(owner && account?.features.canWriteHoopFeed && !offline);
  const [draft, setDraft] = useState<{ owner: string; caption: string; topic: ReelTopic }>({ owner: "", caption: "", topic: "" });
  const [message, setMessage] = useState("");
  const [myReels, setMyReels] = useState<OwnReel[]>([]);
  const [listing, setListing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    if (!owner || !allowed) { setDraft({ owner: "", caption: "", topic: "" }); setMyReels([]); return; }
    let active = true;
    setDraft({ owner: "", caption: "", topic: "" });
    void readReelCaptionDraft(AsyncStorage, owner)
      .then(value => { if (active) setDraft({ owner, ...value }); })
      .catch(() => { if (active) { setDraft({ owner, caption: "", topic: "" }); setMessage("Saved caption could not be loaded from this device."); } });
    return () => { active = false; };
  }, [owner, allowed]);

  useEffect(() => {
    if (!owner || !allowed || draft.owner !== owner) return;
    const timer = setTimeout(() => {
      void writeReelCaptionDraft(AsyncStorage, owner, { caption: draft.caption, topic: draft.topic })
        .catch(() => setMessage("Could not save this caption draft to the device."));
    }, 500);
    return () => clearTimeout(timer);
  }, [owner, allowed, draft]);

  const refreshMine = useCallback(async () => {
    if (!owner || !allowed) return;
    const current = ++generation.current;
    setListing(true);
    try {
      const { data, error } = await supabase.from("feed_posts")
        .select("id,body,created_at,status")
        .eq("author_id", owner).eq("status", "approved").not("video_url", "is", null)
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      if (generation.current === current) setMyReels(((data || []) as OwnReel[]).filter(row => isUuid(row.id)));
    } catch {
      if (generation.current === current) setMessage("Your published Reels could not be loaded. Try again.");
    } finally { if (generation.current === current) setListing(false); }
  }, [owner, allowed]);

  useEffect(() => {
    if (allowed) void refreshMine();
    return () => { generation.current++; };
  }, [allowed, refreshMine]);

  const getToken = useCallback(async () => {
    if (!owner || !allowed) throw new Error("Creator membership could not be verified.");
    await requireOnline();
    const { data, error } = await supabase.auth.getSession();
    if (error || data.session?.user.id !== owner || !data.session.access_token) throw new Error("Sign in again to publish this Reel.");
    return data.session.access_token;
  }, [owner, allowed]);

  async function saveDraft() {
    if (!owner || draft.owner !== owner) return;
    try {
      await writeReelCaptionDraft(AsyncStorage, owner, { caption: draft.caption, topic: draft.topic });
      setMessage("Caption and topic saved to this device. Re-select your video when you return.");
    } catch { setMessage("Could not save this caption draft to the device."); }
  }

  function discardDraft() {
    if (!owner || draft.owner !== owner) return;
    Alert.alert("Discard caption draft?", "This clears the saved caption and topic on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => {
        setDraft({ owner, caption: "", topic: "" });
        void clearReelCaptionDraft(AsyncStorage, owner)
          .then(() => setMessage("Caption draft discarded."))
          .catch(() => setMessage("Could not clear the saved draft."));
      } },
    ]);
  }

  function confirmDelete(reel: OwnReel) {
    if (!owner || !allowed || !isUuid(reel.id) || deleting) return;
    Alert.alert("Delete this Reel?", "This permanently removes your HoopCheck post. It cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { void deleteOwnReel(reel.id); } },
    ]);
  }
  async function deleteOwnReel(postId: string) {
    if (!owner || !allowed || !isUuid(postId) || deleting) return;
    setDeleting(postId); setMessage("");
    try {
      await getToken();
      // RLS permits only the author to delete; the exact author and post IDs
      // are also constrained on the client. Require a returned row as receipt.
      const { data, error } = await supabase.from("feed_posts")
        .delete().eq("id", postId).eq("author_id", owner).select("id").maybeSingle();
      if (error || data?.id !== postId) throw new Error("Deletion could not be confirmed. Refresh your Reels before retrying.");
      setMyReels(rows => rows.filter(row => row.id !== postId));
      setMessage("Your Reel was deleted from HoopCheck.");
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "Reel deletion failed.");
    } finally { setDeleting(null); }
  }

  const userId = owner!;
  const caption = draft.owner === owner ? draft.caption : "";
  const topic = draft.owner === owner ? draft.topic : "";
  const textColor = theme.foreground;

  if (loading) return <View style={{ flex: 1, padding: 20, backgroundColor: theme.background }}><Skeleton /></View>;
  if (!account || !allowed) return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: 22, gap: 16, justifyContent: "center" }}>
    <Text accessibilityRole="header" style={{ color: textColor, fontSize: 23, fontWeight: "800" }}>HoopReels Creator Studio</Text>
    <Text style={{ color: theme.muted }}>{offline ? "Reconnect to verify your creator access." : account ? "Your membership does not include posting on HoopFeed." : accountError}</Text>
    <Pressable accessibilityRole="button" onPress={retry} style={{ minHeight: 48 }}><Text style={{ color: theme.accent }}>Verify access again</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.replace("/reels")} style={{ minHeight: 48 }}><Text style={{ color: theme.accent }}>Back to Reels</Text></Pressable>
  </SafeAreaView>;
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to HoopReels" onPress={() => router.replace("/reels")}
          style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: theme.border, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="arrow-back" size={22} color={textColor} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ color: textColor, fontSize: 21, fontWeight: "900" }}>CREATOR STUDIO</Text>
          <Text style={{ color: theme.muted, fontSize: 12 }}>Make your next hoop highlight count</Text>
        </View>
      </View>

      <View style={{ gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
        <Text style={{ color: textColor, fontSize: 15, fontWeight: "800" }}>1. Caption your highlight</Text>
        <TextInput accessibilityLabel="Reel caption" placeholder="What happened on the court? Add a caption…"
          placeholderTextColor={theme.muted} multiline maxLength={2000}
          value={caption} onChangeText={value => setDraft({ owner: userId, caption: value, topic })}
          style={{ minHeight: 84, maxHeight: 180, borderRadius: 12, borderColor: theme.border, borderWidth: 1,
            backgroundColor: theme.input, color: textColor, textAlignVertical: "top", padding: 12, fontSize: 15 }} />
        <Text style={{ color: theme.muted, fontSize: 12, textAlign: "right" }}>{caption.length}/2000</Text>
        <Text style={{ color: textColor, fontSize: 14, fontWeight: "800" }}>Basketball topic</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {(["", ...REEL_TOPICS] as ReelTopic[]).map(value =>
            <Pressable key={value || "none"} accessibilityRole="button" accessibilityLabel={value ? "Topic " + value : "No topic"}
              accessibilityState={{ selected: topic === value }} onPress={() => setDraft({ owner: userId, caption, topic: value })}
              style={{ minHeight: 44, borderRadius: 999, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1,
                borderColor: topic === value ? theme.accent : theme.border, backgroundColor: topic === value ? theme.accentSurface : theme.elevatedSurface }}>
              <Text style={{ color: topic === value ? theme.accent : theme.muted, fontSize: 12, fontWeight: "700" }}>{value || "None"}</Text>
            </Pressable>)}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => void saveDraft()} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ color: theme.accent, fontSize: 14, fontWeight: "800" }}>Save caption draft</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={discardDraft} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ color: theme.muted, fontSize: 14 }}>Discard caption</Text>
          </Pressable>
        </View>
        <Text style={{ color: theme.muted, fontSize: 12 }}>Only your caption and topic are saved on this device. Your selected video must be chosen again if you close the Studio.</Text>
      </View>

      <View style={{ gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
        <Text style={{ color: textColor, fontSize: 15, fontWeight: "800" }}>2. Select, preview and publish</Text>
        <MediaPostComposer key={userId} userId={userId} enabled={allowed} caption={caption} topicTag={topic}
          videoOnly token={getToken} onRefresh={refreshMine}
          onPublished={async () => {
            try { await clearReelCaptionDraft(AsyncStorage, userId); } catch { /* A stale caption draft does not change publication. */ }
            setDraft({ owner: userId, caption: "", topic: "" });
            router.replace("/reels");
          }} />
      </View>

      <View style={{ gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text accessibilityRole="header" style={{ color: textColor, fontSize: 17, fontWeight: "800" }}>My Reels</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh my Reels" onPress={() => void refreshMine()} style={{ minWidth: 48, minHeight: 48, justifyContent: "center", alignItems: "center" }}>
            <Ionicons name="refresh" size={19} color={theme.accent} />
          </Pressable>
        </View>
        {listing ? <Text style={{ color: theme.muted }}>Loading your published Reels…</Text> : !myReels.length ?
          <Text style={{ color: theme.muted }}>No published Reels found. Your next highlight starts here.</Text> :
          myReels.map(reel => <View key={reel.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: theme.border, gap: 8 }}>
            <Text style={{ color: textColor, fontSize: 14, fontWeight: "700" }} numberOfLines={2}>{reel.body || "Video highlight"}</Text>
            <Text style={{ color: theme.muted, fontSize: 11 }}>{new Date(reel.created_at).toLocaleDateString()}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Share my Reel"
                onPress={() => void Share.share({ title: "HoopReels", message: "https://hoopcheck.online/feed#post-" + reel.id })}
                style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: theme.accent }}>Share</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Delete my Reel" disabled={Boolean(deleting)}
                onPress={() => confirmDelete(reel)} style={{ minHeight: 44, justifyContent: "center" }}>
                <Text style={{ color: "#FFB5A2" }}>{deleting === reel.id ? "Deleting…" : "Delete"}</Text>
              </Pressable>
            </View>
          </View>)}
      </View>
      {message ? <Text accessibilityRole="alert" style={{ color: theme.foreground }}>{message}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}
