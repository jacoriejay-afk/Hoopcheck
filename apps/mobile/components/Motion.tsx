import { useMotionSetting } from "../src/motion/Provider";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "./BrandLockup";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import { motion } from "../src/motion/config";
import { useEntryTheme } from "../src/theme";

export function Reveal({ children, index = 0 }: { children: ReactNode; index?: number }) {
  const reduced = useMotionSetting();
  return <Animated.View entering={FadeIn.duration(reduced ? motion.shortFade : motion.fade).delay(reduced ? 0 : Math.min(index, motion.maxStagger) * motion.stagger)}>{children}</Animated.View>;
}

const Shimmer = createContext<SharedValue<number> | null>(null);
function Bone({ style }: { style: ViewStyle }) {
  const theme = useEntryTheme();
  const reduced = useMotionSetting();
  const progress = useContext(Shimmer);
  const [width, setWidth] = useState(0);
  const shine = useAnimatedStyle(() => ({ transform: [{ translateX: (progress?.get() ?? 0) * (width + motion.shimmerWidth) - motion.shimmerWidth }] }));
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[{ backgroundColor: theme.border, borderRadius: 8, overflow: "hidden" }, style]}>
    {!reduced ? <Animated.View pointerEvents="none" style={[{ position: "absolute", width: motion.shimmerWidth, top: 0, bottom: 0 }, shine]}><LinearGradient colors={["transparent", theme.surface, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, opacity: 0.5 }} /></Animated.View> : null}
  </View>;
}

// Reserved footprint exists immediately; shimmer starts only after the delay.
export function Skeleton({ profile = false, review = false, branded = false }: { profile?: boolean; review?: boolean; branded?: boolean }) {
  const theme = useEntryTheme();
  const reduced = useMotionSetting();
  const [visible, setVisible] = useState(false);
  const progress = useSharedValue(0);
  useEffect(() => { const timer = setTimeout(() => setVisible(true), motion.skeletonDelay); return () => clearTimeout(timer); }, []);
  useEffect(() => {
    if (visible && !reduced) progress.set(withRepeat(withTiming(1, { duration: motion.shimmer }), -1, false));
    else { cancelAnimation(progress); progress.set(0); }
    return () => cancelAnimation(progress);
  }, [visible, reduced, progress]);
  return <View accessibilityLabel="Loading content" accessibilityRole="progressbar" style={{ padding: profile ? 0 : 16 }}>
    <View style={{ opacity: visible ? 1 : 0 }}><Shimmer.Provider value={progress}>
      {branded && <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ height: 42, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
        {visible && <BrandMark size={34} animated />}
        <Text style={{ color: theme.muted, fontSize: 13 }}>Loading HoopCheck…</Text>
      </View>}
      {profile && <View style={{ gap: 12, marginBottom: 26 }}><Bone style={{ width: 66, height: 66 }} /><Bone style={{ width: "70%", height: 32 }} /><Bone style={{ width: "45%", height: 18 }} /></View>}
      {Array.from({ length: review ? 1 : profile ? 2 : 5 }, (_, index) => <View key={index} style={{ flexDirection: "row", gap: 12, padding: 14, marginBottom: 10, minHeight: review ? 120 : 100, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12 }}>
        {!profile && !review && <Bone style={{ width: 44, height: 44 }} />}
        <View style={{ flex: 1, gap: 10 }}><Bone style={{ height: 18, width: "72%" }} /><Bone style={{ height: 14, width: "90%" }} /><Bone style={{ height: 14, width: "40%" }} /></View>
      </View>)}
    </Shimmer.Provider></View>
  </View>;
}
