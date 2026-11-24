import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { useEntryTheme } from "../src/theme";
import { BrandLogo } from "./BrandLogo";

/** Small, branded, reduce-motion-aware wait state instead of bulky placeholder boxes. */
export function HoopCheckLoading({ label = "Loading HoopCheck…", compact = false }: { label?: string; compact?: boolean }) {
  const t = useEntryTheme();
  const reduced = useMotionSetting();
  const breathe = useSharedValue(reduced ? 1 : 0.55);
  useEffect(() => {
    cancelAnimation(breathe);
    if (reduced) { breathe.set(1); return; }
    breathe.set(0.55);
    breathe.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
    return () => cancelAnimation(breathe);
  }, [reduced, breathe]);
  const animated = useAnimatedStyle(() => ({ opacity: breathe.get() }));
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityState={{ busy: true }} style={{ minHeight: compact ? 48 : 110, flexDirection: compact ? "row" : "column", alignItems: "center", justifyContent: "center", gap: compact ? 9 : 12, padding: compact ? 7 : 16 }}>
    <Animated.View style={animated} pointerEvents="none"><BrandLogo compact /></Animated.View>
    <Text style={{ fontSize: 13, fontWeight: "600", color: t.muted }}>{label}</Text>
  </View>;
}
