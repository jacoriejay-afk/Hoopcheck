import { useEffect, type ReactNode } from "react";
import { usePathname } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { motion } from "../src/motion/config";
import { useMotionSetting } from "../src/motion/Provider";

// Conservative crossfade fallback until shared-element paths pass device profiling.
export function RouteFade({ children }: { children: ReactNode }) {
  const path = usePathname();
  const reduced = useMotionSetting();
  const opacity = useSharedValue(1);
  useEffect(() => { opacity.set(0); opacity.set(withTiming(1, { ...motion.timing, duration: reduced ? motion.shortFade : motion.fade })); }, [path, reduced, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
}
