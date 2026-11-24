import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ChatMessageEnter, ChatTypingBasketball, useConfirmedMessageMotion } from "./chat/ChatMotion";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useNativeDraft } from "../src/native/drafts";
import { Button } from "../src/primitives";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";
import { requireOnline } from "../src/native/network";
import { readGameRoom, reportGameMessage, sendGameMessage, setGameChatControl, type ChatMessage } from "../src/native/liveGames";
type Room = Awaited<ReturnType<typeof readGameRoom>>;
const emptyMessages: ChatMessage[] = [];
export function GameChat({ gameId, userId, enabled }: { gameId: string; userId: string; enabled: boolean }) {
  const theme = useEntryTheme();
  const scope = `${userId}:${gameId}`;
  const current = useRef({ scope, enabled });
  useLayoutEffect(() => { current.current = { scope, enabled }; }, [scope, enabled]);
  const [snapshot, setSnapshot] = useState<{ scope: string; room: Room } | null>(null);
  const [text, setDraft] = useNativeDraft(`game:chat:${gameId}`, userId);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(false);
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<{ scope: string; item: ChatMessage } | null>(null);
  const [reason, setReason] = useState("harassment");
  const [managing, setManaging] = useState(false);
  const [details, setDetails] = useState("");
  useEffect(() => {
    if (!enabled) { setSnapshot(null); return; }
    let valid = true, loading = false, dirty = false;
    const refresh = async () => {
      if (loading) { dirty = true; return; }
      loading = true;
      try {
        const room = await readGameRoom(supabase, gameId, userId);
        if (valid) setSnapshot({ scope, room });
      } catch { if (valid) { setSnapshot(null); setNotice("Chat could not load. Reconnecting…"); } }
      finally { loading = false; if (dirty && valid) { dirty = false; void refresh(); } }
    };
    void refresh();
    let queued: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (queued) return;
      queued = setTimeout(() => { queued = undefined; if (valid) void refresh(); }, 300);
    };
    // Re-read through RLS and current blocks/mutes; never render raw realtime payloads.
    const channel = supabase.channel(`native-game:${userId}:${gameId}`).on("postgres_changes", { event: "*", schema: "public", table: "fan_live_chat_messages", filter: `game_id=eq.${gameId}` }, schedule).subscribe();
    const timer = setInterval(() => void refresh(), 15000);
    return () => { valid = false; clearInterval(timer); clearTimeout(queued); void supabase.removeChannel(channel); };
  }, [enabled, gameId, userId, scope, revision]);
  const room = enabled && snapshot?.scope === scope ? snapshot.room : null;
  const reportTarget = report?.scope === scope ? report.item : null;
  const [motionFocused, setMotionFocused] = useState(false);
  useFocusEffect(useCallback(() => { setMotionFocused(true); return () => setMotionFocused(false); }, []));
  const motionActive = motionFocused && enabled && room?.open === true && !reportTarget && !managing;
  const freshIds = useConfirmedMessageMotion(scope, room?.messages ?? emptyMessages, motionActive);
  async function action(task: () => Promise<void>) {
    if (request.current || !enabled) return;
    request.current = true; setBusy(true); setNotice("");
    try {
      await requireOnline();
      const { data, error } = await supabase.auth.getSession();
      if (error || data.session?.user.id !== userId || current.current.scope !== scope || !current.current.enabled) throw new Error("Sign in again before continuing.");
      await task();
    } catch (failure) { if (current.current.scope === scope) setNotice(failure instanceof Error ? failure.message : "The action could not be confirmed."); }
    finally { request.current = false; if (current.current.scope === scope) setBusy(false); }
  }
  async function send() {
    if (!room?.open || !text.trim()) return;
    await action(async () => {
      await sendGameMessage(supabase, gameId, userId, text);
      setDraft(previous => previous === text ? "" : previous);
      if (current.current.scope === scope) setRevision(value => value + 1);
    });
  }
  function control(targetId: string, kind: "block" | "mute") {
    const existing = room?.controls.find(control => control.target_user_id === targetId);
    return action(async () => {
      await setGameChatControl(supabase, userId, targetId, kind === "block" ? !existing?.is_blocked : existing?.is_blocked === true, kind === "mute" ? !existing?.is_muted : existing?.is_muted === true);
      if (current.current.scope === scope) { setSnapshot(null); setRevision(value => value + 1); }
    });
  }
  if (reportTarget) return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 20 }}><Text accessibilityRole="header" style={{ color: theme.foreground }}>Report message</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{["harassment", "spam", "hate", "threat", "other"].map(value => <Pressable key={value} accessibilityRole="radio" aria-checked={reason === value} accessibilityState={{ checked: reason === value }} onPress={() => setReason(value)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: reason === value ? theme.accent : theme.foreground }}>{value}</Text></Pressable>)}</View>
      <TextInput accessibilityLabel="Report details" maxLength={500} value={details} onChangeText={setDetails} style={{ color: theme.foreground, backgroundColor: theme.input, minHeight: 48, padding: 12 }} />
      <Button secondary disabled={busy} onPress={() => void action(async () => { await reportGameMessage(supabase, gameId, userId, reportTarget, reason, details); if (current.current.scope === scope) { setReport(null); setDetails(""); setNotice("Report sent to HoopCheck moderators."); } })}>Submit report</Button><Button secondary onPress={() => setReport(null)}>Cancel report</Button>{notice ? <Text accessibilityRole="alert" style={{ color: theme.muted }}>{notice}</Text> : null}
</ScrollView>;
  return <View style={{ gap: 12, flex: 1 }}>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 23, fontWeight: "800" }}>Game chat</Text>
    {!enabled ? <Text style={{ color: theme.muted }}>Live chat requires eligible active membership. Free players can still make game predictions.</Text> : !room ? <Text style={{ color: theme.muted }}>Verifying room access…</Text> : !room.open ? <Text style={{ color: theme.muted }}>This room is closed. Chat opens 60 minutes before tip-off and closes when the game ends.</Text> : <>
      <FlatList style={{ flex: 1, minHeight: 0 }} inverted data={[...room.messages].reverse()} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Text style={{ color: theme.muted }}>No messages yet.</Text>} renderItem={({ item }) => <ChatMessageEnter fresh={freshIds.has(item.id)} incoming={item.user_id !== userId} active={motionActive}><View style={{ paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderColor: theme.border }}>
        <Text style={{ color: theme.foreground, fontWeight: "800" }}>{room.names[item.user_id] || "HoopCheck member"}</Text>
        <Text style={{ color: theme.foreground }}>{item.body}</Text><Text style={{ color: theme.muted }}>{new Date(item.created_at).toLocaleTimeString()}</Text>
        {item.user_id !== userId ? <View style={{ flexDirection: "row", gap: 12 }}>{["mute", "block", "report"].map(kind => <Pressable key={kind} accessibilityRole="button" accessibilityLabel={`${kind} ${room.names[item.user_id] || "member"}`} disabled={busy} onPress={() => { if (kind === "report") { setReason("harassment"); setDetails(""); setReport({ scope, item }); } else void control(item.user_id, kind as "block" | "mute"); }} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: theme.accent, textTransform: "capitalize" }}>{kind}</Text></Pressable>)}</View> : null}
      </View></ChatMessageEnter>} />
      <ChatTypingBasketball active={motionActive && Boolean(text.trim()) && !busy} />
      <TextInput accessibilityLabel="Game chat message" placeholder="Message the room" placeholderTextColor={theme.muted} value={text} maxLength={500} multiline onChangeText={setDraft} style={{ color: theme.foreground, backgroundColor: theme.input, borderColor: theme.border, borderWidth: 1, borderRadius: theme.radius.control, padding: 12, minHeight: 48, maxHeight: 120 }} />
      <Button disabled={busy || !text.trim()} onPress={() => void send()}>{busy ? "Sending…" : "Send message"}</Button>
    </>}
    {room?.controls.some(control => control.is_muted || control.is_blocked) ? <Button secondary onPress={() => setManaging(value => !value)}>{managing ? "Close hidden members" : "Manage hidden members"}</Button> : null}
    {managing ? <ScrollView style={{ maxHeight: 180 }}>{room?.controls.filter(control => control.is_muted || control.is_blocked).map(item => <View key={item.target_user_id} style={{ gap: 4 }}><Text style={{ color: theme.muted }}>Hidden member · {item.is_blocked ? "Blocked" : "Muted"}</Text><Button secondary disabled={busy} onPress={() => void action(async () => { await setGameChatControl(supabase, userId, item.target_user_id, false, false); if (current.current.scope === scope) { setManaging(false); setRevision(value => value + 1); } })}>Restore messages</Button></View>)}</ScrollView> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={{ color: theme.muted }}>{notice}</Text> : null}
  </View>;
}
