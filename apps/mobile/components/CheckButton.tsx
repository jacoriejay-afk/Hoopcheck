import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useHaptics } from "../src/native/haptics";
import { requireOnline } from "../src/native/network";
import { motion } from "../src/motion/config";
import { useMotionSetting } from "../src/motion/Provider";
import { useEntryTheme } from "../src/theme";

type CheckState = { checked: boolean; count: number };
// A view primitive only. The caller must use its existing authorized Check API.
// No feed surface is enabled and no entitlement resolver is duplicated here.
export function CheckButton({ state, commit }: { state: CheckState; commit: (checked: boolean) => Promise<CheckState> }) {
  const theme = useEntryTheme();
  const reduced = useMotionSetting();
  const haptic = useHaptics();
  const [display, setDisplay] = useState(state);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const scale = useSharedValue(1);
  const pulse = useSharedValue(0);
  useEffect(() => { if (!pending.current) setDisplay({ checked: state.checked, count: state.count }); }, [state.checked, state.count]);
  const arrow = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const glow = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  async function toggle() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError("");
    const before = display;
    try {
      await requireOnline();
      const next = { checked: !before.checked, count: Math.max(0, before.count + (before.checked ? -1 : 1)) };
      setDisplay(next);
      if (!reduced) {
        scale.set(withSequence(withTiming(next.checked ? 1.18 : 0.9, motion.timing), withSpring(1, motion.spring)));
        if (next.checked) pulse.set(withSequence(withTiming(0.28, motion.timing), withTiming(0, motion.timing)));
      }
      const result = await commit(next.checked);
      if (!Number.isInteger(result.count) || result.count < 0) throw new Error("Invalid Check result");
      setDisplay(result);
      haptic("check");
    } catch {
      setDisplay(before);
      if (!reduced) scale.set(withSpring(1, motion.spring));
      else scale.set(1);
      pulse.set(0);
      setError("Check wasn’t saved. Reconnect and try again.");
      haptic("error");
    } finally { pending.current = false; setBusy(false); }
  }
  return <View><Pressable accessibilityRole="button" accessibilityLabel={`${display.checked ? "Remove Check" : "Check"}, ${display.count} Checks`} accessibilityState={{ selected: display.checked, disabled: busy, busy }} disabled={busy} onPress={() => void toggle()} style={{ flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: 12, gap: 8, borderRadius: 14, overflow: "hidden", backgroundColor: theme.surface }}>
    <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: 0, backgroundColor: theme.button }, glow]} />
    <Animated.View style={arrow}><Svg width={22} height={22} viewBox="500 470 410 520"><Path d="M891 486 781 793 510 971 743 760 790 630 635 766 671 668Z" fill={display.checked ? theme.accent : theme.muted} /></Svg></Animated.View>
    <View style={{ height: 24, minWidth: 40, overflow: "hidden", justifyContent: "center" }}><Animated.Text key={display.count} entering={reduced ? undefined : FadeInDown.duration(motion.fade)} exiting={reduced ? undefined : FadeOutUp.duration(motion.fade)} style={{ color: theme.foreground, fontVariant: ["tabular-nums"] }}>{display.count}</Animated.Text></View>
  </Pressable>{error ? <Text accessibilityRole="alert" style={{ color: theme.error, marginTop: 6 }}>{error}</Text> : null}</View>;
}
