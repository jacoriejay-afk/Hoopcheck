import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { ProfileAvatar } from "./ProfileAvatar";
import { ReelStreamVideo } from "./ReelStreamVideo";
import type { FeedPost } from "../src/native/feedClient";

type IconName = ComponentProps<typeof Ionicons>["name"];
type Props = {
  post: FeedPost; userId: string; height: number; active: boolean; ready: boolean;
  canWrite: boolean; muted: boolean; pulseKey: number;
  check?: { count: number; mine: boolean }; saved?: boolean;
  checkBusy: boolean; saveBusy: boolean; blockBusy: boolean;
  onBack: () => void; onCreate: () => void; onViewPlayer: () => void;
  onMute: () => void; onTeam: () => void; onSound: () => void;
  onCheck: () => void; onComments: () => void; onShare: () => void; onSave: () => void;
  onReport: () => void; onHide: () => void; onHideCreator: () => void; onBlockCreator: () => void;
};
const ink = "#FFFFFF", mutedInk = "#DAE2EB", orange = "#FF8645";
const glass = "rgba(12,19,31,.76)", border = "rgba(255,255,255,.21)";

function ReelAction({ icon, label, detail, onPress, disabled = false, selected = false }: {
  icon: IconName; label: string; detail?: string; onPress: () => void; disabled?: boolean; selected?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ alignItems: "center", minWidth: 54, minHeight: 50, gap: 2, opacity: disabled ? .45 : pressed ? .7 : 1 })}>
    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: glass, borderColor: selected ? orange : border, borderWidth: 1, justifyContent: "center", alignItems: "center" }}>
      <Ionicons name={icon} size={23} color={selected ? orange : ink} />
    </View>
    {detail ? <Text style={{ color: ink, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{detail}</Text> : null}
  </Pressable>;
}

/** A card consumes only the validated provider catalog source, never video_url.
 * The caller owns membership, signed catalog authorization, real Check totals
 * and moderation. The shared sound setting survives card recycling.
 */
export function HoopReelCard({
  post, userId, height, active, ready, canWrite, muted, pulseKey, check, saved, checkBusy, saveBusy, blockBusy,
  onViewPlayer, onMute, onTeam, onSound, onCheck, onComments, onShare, onSave, onReport, onHide, onHideCreator, onBlockCreator,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const reduced = useMotionSetting();
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receipt = useRef(pulseKey);
  const burst = useSharedValue(0), burstScale = useSharedValue(.7), disc = useSharedValue(0);
  useEffect(() => {
    if (!active) { setMenuOpen(false); setExpanded(false); }
    return () => { if (tapTimer.current) clearTimeout(tapTimer.current); tapTimer.current = null; };
  }, [active, post.id]);
  useEffect(() => {
    const next = pulseKey > receipt.current;
    receipt.current = pulseKey;
    if (!next || !active || reduced) return;
    burst.set(withSequence(withTiming(1, { duration: 100 }), withTiming(1, { duration: 180 }), withTiming(0, { duration: 230 })));
    burstScale.set(withSequence(withTiming(1.25, { duration: 130 }), withTiming(1, { duration: 140 })));
  }, [pulseKey, active, reduced, burst, burstScale]);
  const playing = active && !menuOpen;
  useEffect(() => {
    if (playing && !reduced) disc.set(withRepeat(withTiming(360, { duration: 3600, easing: Easing.linear }), -1, false));
    else { cancelAnimation(disc); disc.set(0); }
    return () => cancelAnimation(disc);
  }, [playing, reduced, disc]);
  const burstStyle = useAnimatedStyle(() => ({ opacity: burst.get(), transform: [{ scale: burstScale.get() }] }));
  const discStyle = useAnimatedStyle(() => ({ transform: [{ rotate: disc.get() + "deg" }] }));
  function videoTap() {
    if (!active || menuOpen) return;
    if (tapTimer.current) {
      clearTimeout(tapTimer.current); tapTimer.current = null;
      if (canWrite && check && !check.mine && !checkBusy) onCheck();
      return;
    }
    tapTimer.current = setTimeout(() => { tapTimer.current = null; onMute(); }, 250);
  }
  const ownReel = post.author_id === userId;
  const handle = post.profiles?.username ? "@" + post.profiles.username : post.profiles?.display_name || "HoopCheck member";
  const playerProfile = post.profiles?.account_type?.toLowerCase() === "player";
  return <View testID="hoopreels-immersive-card" style={{ height, backgroundColor: "#05080E", overflow: "hidden" }}>
    {ready && post.reel_source ? <ReelStreamVideo key={post.reel_source.hlsUrl} source={post.reel_source} active={playing} muted={muted} /> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={muted ? "Unmute Reel with one tap, Check with two taps" : "Mute Reel with one tap, Check with two taps"}
      onPress={videoTap} style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none" accessible={false}
      colors={["rgba(4,7,13,.5)", "rgba(4,7,13,.02)", "rgba(4,7,13,.08)", "rgba(4,7,13,.94)"]}
      locations={[0, .17, .52, 1]} style={StyleSheet.absoluteFill} />
    <Animated.View pointerEvents="none" accessible={false}
      style={[{ position: "absolute", top: "40%", alignSelf: "center" }, burstStyle]}>
      <Ionicons name="arrow-up-circle" size={102} color={orange} />
    </Animated.View>

    <View style={{ position: "absolute", bottom: 112, left: 14, right: 12, flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
      <View style={{ flex: 1, gap: 7 }}>
        <Pressable accessibilityRole={playerProfile ? "button" : undefined} accessibilityLabel={playerProfile ? "View player profile" : undefined}
          disabled={!playerProfile} onPress={onViewPlayer} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ProfileAvatar name={post.profiles?.display_name || "HoopCheck member"} url={post.profiles?.avatar_moderation_status === "approved" ? post.profiles.avatar_url : null} size={38} />
          <View style={{ flex: 1 }}><Text style={{ color: ink, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>{handle}</Text>
            {playerProfile ? <Text style={{ color: orange, fontSize: 11, fontWeight: "700" }}>View player profile</Text> : null}
          </View>
        </Pressable>
        {post.body ? <Pressable accessibilityRole="button" accessibilityLabel={expanded ? "Collapse Reel caption" : "Expand Reel caption"} onPress={() => setExpanded(value => !value)}>
          <Text style={{ color: ink, fontSize: 14, lineHeight: 20 }} numberOfLines={expanded ? 8 : 2}>{post.body}</Text>
        </Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Sound information" onPress={onSound}
          style={{ flexDirection: "row", gap: 5, alignItems: "center", minHeight: 44 }}>
          <Ionicons name="musical-notes" size={15} color={mutedInk} /><Text style={{ color: mutedInk, fontSize: 12 }} numberOfLines={1}>Sound information</Text>
        </Pressable>
        {post.reel_team ? <Pressable accessibilityRole="button" accessibilityLabel={post.reel_team.name + " — See the reviews"}
          onPress={onTeam} style={{ minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: border, backgroundColor: glass, padding: 8, flexDirection: "row", gap: 5, alignItems: "center" }}>
          <Ionicons name="basketball-outline" size={19} color={orange} /><Text style={{ color: ink, flex: 1, fontSize: 12, fontWeight: "700" }} numberOfLines={2}>{post.reel_team.name} — See the reviews ›</Text>
        </Pressable> : null}
      </View>
      <View style={{ gap: 10, alignItems: "center" }}>
        <ReelAction icon="arrow-up" label={check?.mine ? "Remove Check" : "Check this Reel"} selected={check?.mine === true}
          detail={check ? String(check.count) : undefined} disabled={!canWrite || !check || checkBusy} onPress={onCheck} />
        <ReelAction icon="chatbubble-ellipses-outline" label="Comments" onPress={onComments} />
        <ReelAction icon="arrow-redo-outline" label="Share Reel" onPress={onShare} />
        <ReelAction icon={saved ? "bookmark" : "bookmark-outline"} label={saved ? "Remove saved Reel" : "Save Reel"} selected={saved}
          disabled={!canWrite || saved === undefined || saveBusy} onPress={onSave} />
        <ReelAction icon={muted ? "volume-mute-outline" : "volume-high-outline"} label={muted ? "Unmute Reel" : "Mute Reel"} onPress={onMute} />
        <ReelAction icon={menuOpen ? "close" : "ellipsis-horizontal"} label="Reel options" onPress={() => setMenuOpen(value => !value)} />
        <Pressable accessibilityRole="button" accessibilityLabel="Open sound information" onPress={onSound}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: glass, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center" }}>
          <Animated.View style={discStyle}><Ionicons name="disc-outline" size={30} color={orange} /></Animated.View>
        </Pressable>
      </View>
    </View>
    {menuOpen ? <View style={{ position: "absolute", top: 66, right: 12, width: 226, padding: 8, gap: 4, borderRadius: 18, backgroundColor: "#101928", borderWidth: 1, borderColor: border }}>
      {([
        ["arrow-redo-outline", "Share Reel", onShare, false],
        ["bookmark-outline", saved ? "Remove saved Reel" : "Save Reel", onSave, !canWrite || saved === undefined || saveBusy],
        ["flag-outline", "Report Reel", onReport, false],
        ["eye-off-outline", "Not interested", onHide, false],
        ...(!ownReel ? [["person-remove-outline", "Hide creator", onHideCreator, false], ["ban-outline", "Block account", onBlockCreator, blockBusy]] as const : []),
      ] as [IconName, string, () => void, boolean][]).map(([icon, label, callback, disabled]) =>
        <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
          onPress={() => { setMenuOpen(false); callback(); }} style={{ flexDirection: "row", minHeight: 46, paddingHorizontal: 10, gap: 10, alignItems: "center", opacity: disabled ? .5 : 1 }}>
          <Ionicons name={icon} size={19} color={label === "Block account" ? "#FFB3A3" : ink} /><Text style={{ color: ink, fontSize: 14 }}>{label}</Text>
        </Pressable>)}
    </View> : null}
  </View>;
}
