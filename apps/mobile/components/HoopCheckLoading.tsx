import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { useEntryTheme } from "../src/theme";
import { BrandLogo } from "./BrandLogo";

/** Small, branded, reduce-motion-aware wait state instead of bulky placeholder boxes. */
export function HoopCheckLoading({ label = "Loading HoopCheck…" }: { label?: string }) {
  const t = useEntryTheme();
  const reduced = useMotionSetting();
  const breathe = useSharedValue(0.55);
  useEffect(() => {
    if (reduced) { breathe.set(1); return; }
    breathe.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [reduced, breathe]);
  const animated = useAnimatedStyle(() => ({ opacity: breathe.get() }));
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityState={{ busy: true }} style={{ minHeight: 110, alignItems: "center", justifyContent: "center", gap: 12, padding: 16 }}>
    <Animated.View style={animated} pointerEvents="none"><BrandLogo compact /></Animated.View>
    <Text style={{ fontSize: 13, fontWeight: "600", color: t.muted }}>{label}</Text>
  </View>;
}
