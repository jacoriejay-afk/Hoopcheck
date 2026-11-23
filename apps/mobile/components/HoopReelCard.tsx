import { useEffect, useState, type ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FeedMedia } from "./FeedMedia";
import type { FeedPost } from "../src/native/feedClient";

type IconName = ComponentProps<typeof Ionicons>["name"];
type ReelProps = {
  post: FeedPost;
  userId: string;
  height: number;
  active: boolean;
  ready: boolean;
  canWrite: boolean;
  check?: { count: number; mine: boolean };
  saved?: boolean;
  checkBusy: boolean;
  saveBusy: boolean;
  blockBusy: boolean;
  onBack: () => void;
  onCheck: () => void;
  onComments: () => void;
  onShare: () => void;
  onSave: () => void;
  onReport: () => void;
  onHide: () => void;
  onHideCreator: () => void;
  onBlockCreator: () => void;
};

const ink = "#FFFFFF";
const mutedInk = "#DAE2EB";
const orange = "#FF8645";
const glass = "rgba(12, 19, 31, 0.72)";
const border = "rgba(255,255,255,0.21)";

function ReelAction({ icon, label, detail, onPress, disabled = false, selected = false }: {
  icon: IconName; label: string; detail?: string; onPress: () => void;
  disabled?: boolean; selected?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ alignItems: "center", minWidth: 54, minHeight: 54, gap: 3, opacity: disabled ? .45 : pressed ? .7 : 1 })}>
    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: glass,
      borderColor: selected ? orange : border, borderWidth: 1, justifyContent: "center", alignItems: "center" }}>
      <Ionicons name={icon} size={23} color={selected ? orange : ink} />
    </View>
    {detail ? <Text style={{ color: ink, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{detail}</Text> : null}
  </Pressable>;
}

/** Presentation only: access, queries, checks, block RLS, and share/report actions
 * remain owned by the existing HoopFeed screen and its authorized data clients. */
export function HoopReelCard({
  post, userId, height, active, ready, canWrite, check, saved, checkBusy, saveBusy, blockBusy,
  onBack, onCheck, onComments, onShare, onSave, onReport, onHide, onHideCreator, onBlockCreator,
}: ReelProps) {
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!active) { setPaused(false); setMuted(true); setMenuOpen(false); }
  }, [active]);
  const playing = active && !paused && !menuOpen;
  const ownReel = post.author_id === userId;
  return <View testID="hoopreels-immersive-card" style={{ height, backgroundColor: "#05080E", overflow: "hidden" }}>
    {post.video_url ? <View style={StyleSheet.absoluteFill}>
      <FeedMedia userId={userId} postId={post.id} reference={post.video_url} video
        height={height} enabled={ready} loop playing={playing} muted={muted} immersive />
    </View> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={paused ? "Play Reel" : "Pause Reel"}
      onPress={() => setPaused(value => !value)} style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none" accessible={false}
      colors={["rgba(4,7,13,0.66)", "rgba(4,7,13,0.03)", "rgba(4,7,13,0.06)", "rgba(4,7,13,0.92)"]}
      locations={[0, .18, .53, 1]} style={StyleSheet.absoluteFill} />

    <View style={{ position: "absolute", top: 12, left: 12, right: 12,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to HoopFeed"
        onPress={onBack} style={({ pressed }) => ({ minHeight: 48, minWidth: 48, flexDirection: "row", gap: 6,
        borderRadius: 24, paddingHorizontal: 12, alignItems: "center", backgroundColor: glass,
        borderWidth: 1, borderColor: border, opacity: pressed ? .75 : 1 })}>
        <Ionicons name="arrow-back" size={20} color={ink} />
        <Text style={{ color: ink, fontWeight: "900", letterSpacing: .6, fontSize: 14 }}>REELS</Text>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 7 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? "Unmute Reel" : "Mute Reel"}
          onPress={() => setMuted(value => !value)}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: glass, borderWidth: 1,
            borderColor: border, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={muted ? "volume-mute-outline" : "volume-high-outline"} size={23} color={ink} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Reel options"
          accessibilityState={{ expanded: menuOpen }} onPress={() => setMenuOpen(value => !value)}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: glass,
            borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={menuOpen ? "close" : "ellipsis-horizontal"} size={23} color={ink} />
        </Pressable>
      </View>
    </View>

    {paused && active && !menuOpen ? <View pointerEvents="none" accessible={false}
      style={{ position: "absolute", alignSelf: "center", top: Math.max(85, height * .40),
        width: 66, height: 66, borderRadius: 33, backgroundColor: glass, borderWidth: 1,
        borderColor: border, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="play" color={ink} size={30} />
    </View> : null}

    {menuOpen ? <View style={{ position: "absolute", top: 68, right: 12, width: 224,
      padding: 8, gap: 4, borderRadius: 18, backgroundColor: "#101928",
      borderWidth: 1, borderColor: border }}>
      {([
        ["flag-outline", "Report Reel", onReport, false],
        ["eye-off-outline", "Hide this Reel", onHide, false],
        ...(!ownReel ? [
          ["person-remove-outline", "Hide creator", onHideCreator, false],
          ["ban-outline", "Block account", onBlockCreator, blockBusy],
        ] as const : []),
      ] as [IconName, string, () => void, boolean][]).map(([icon, label, callback, disabled]) =>
        <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
          onPress={() => { setMenuOpen(false); callback(); }}
          style={{ flexDirection: "row", minHeight: 46, paddingHorizontal: 10, gap: 10, alignItems: "center", opacity: disabled ? .5 : 1 }}>
          <Ionicons name={icon} size={19} color={label === "Block account" ? "#FFB3A3" : ink} />
          <Text style={{ color: ink, fontSize: 14 }}>{label}</Text>
        </Pressable>)}
    </View> : null}

    <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom: 128,
      flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: ink, fontWeight: "900", fontSize: 17 }} numberOfLines={1}>
          {post.profiles?.display_name || "HoopCheck member"}
        </Text>
        <Text style={{ color: mutedInk, fontSize: 12 }} numberOfLines={1}>
          {post.profiles?.account_type || "Community"} · {new Date(post.created_at).toLocaleDateString()}
        </Text>
        {post.body ? <Text style={{ color: ink, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>{post.body}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Open Reel comments in HoopFeed"
          onPress={onComments} style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: orange, fontSize: 13, fontWeight: "800" }}>View discussion</Text>
        </Pressable>
      </View>
      <View style={{ gap: 13, alignItems: "center" }}>
        <ReelAction icon={check?.mine ? "checkmark-circle" : "checkmark-circle-outline"}
          label={check?.mine ? "Remove Check" : "Check this Reel"} selected={check?.mine === true}
          detail={check ? String(check.count) : undefined}
          disabled={!canWrite || !check || checkBusy} onPress={onCheck} />
        <ReelAction icon="chatbubble-ellipses-outline" label="Comments" onPress={onComments} />
        <ReelAction icon={saved ? "bookmark" : "bookmark-outline"} label={saved ? "Remove saved Reel" : "Save Reel"}
          selected={saved} disabled={!canWrite || saved === undefined || saveBusy} onPress={onSave} />
        <ReelAction icon="arrow-redo-outline" label="Share Reel" onPress={onShare} />
      </View>
    </View>
  </View>;
}
