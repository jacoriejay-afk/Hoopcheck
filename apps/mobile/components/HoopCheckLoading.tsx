import { useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { useEntryTheme } from "../src/theme";
import { BrandLockup, BrandMark } from "./BrandLockup";

/** Native counterpart of components/HoopLoading.tsx: orbit, official wordmark
 * and indeterminate track. No fake percentage or minimum loading delay. */
export function HoopCheckLoading({ label = "Loading HoopCheck…", compact = false }: { label?: string; compact?: boolean }) {
  const t = useEntryTheme();
  const reduced = useMotionSetting();
  const [foreground, setForeground] = useState(() => AppState.currentState !== "background" && AppState.currentState !== "inactive");
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => listener.remove();
  }, []);
  const phase = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(phase);
    phase.set(0);
    if (!reduced && foreground) phase.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(phase);
  }, [reduced, foreground, phase]);
  const outer = useAnimatedStyle(() => ({ transform: [{ rotate: `${phase.get() * 360}deg` }] }));
  const middle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-phase.get() * 720}deg` }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ rotate: `${phase.get() * 1080}deg` }] }));
  const track = useAnimatedStyle(() => ({ transform: [{ translateX: reduced || !foreground ? 29 : -30 + phase.get() * 118 }] }));
  const size = compact ? 34 : 44;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityState={{ busy: true }} style={{ minHeight: compact ? 48 : 110, flexDirection: compact ? "row" : "column", alignItems: "center", justifyContent: "center", gap: compact ? 9 : 10, padding: compact ? 7 : 16 }}>
    <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: t.border, borderTopColor: t.accent }, outer]} />
      <Animated.View style={[{ position: "absolute", width: size * .72, height: size * .72, borderRadius: size, borderWidth: 1.5, borderColor: "transparent", borderRightColor: t.foreground }, middle]} />
      {compact ? <BrandMark size={17} /> : <Animated.View style={[{ position: "absolute", width: size * .42, height: size * .42, borderRadius: size, borderWidth: 1.5, borderColor: "transparent", borderBottomColor: t.accent }, inner]} />}
    </View>
    <View style={{ flexShrink: 1, maxWidth: "100%", alignItems: compact ? "flex-start" : "center", gap: 5 }}>
      {!compact ? <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none"><BrandLockup size={32} /></View> : null}
      <Text style={{ fontSize: 13, fontWeight: "600", color: t.muted, textAlign: compact ? "left" : "center" }}>{label}</Text>
      {!compact ? <View accessible={false} pointerEvents="none" style={{ width: 88, height: 3, borderRadius: 3, overflow: "hidden", backgroundColor: t.border }}>
        <Animated.View style={[{ width: 30, height: 3, borderRadius: 3, backgroundColor: t.accent }, track]} />
      </View> : null}
    </View>
  </View>;
}
