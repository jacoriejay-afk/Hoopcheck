import { useMotionSetting } from "../src/motion/Provider";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { motion } from "../src/motion/config";
import { useHaptics } from "../src/native/haptics";
import { useEntryTheme } from "../src/theme";

const tabs = [
  { route: "/dashboard", label: "Home", icon: "home-outline", active: "home" },
  { route: "/feed", label: "HoopFeed", icon: "chatbubbles-outline", active: "chatbubbles" },
  { route: "/search", label: "Search", icon: "search-outline", active: "search" },
  { route: "/notifications", label: "Alerts", icon: "notifications-outline", active: "notifications" },
  { route: "/account", label: "Account", icon: "person-outline", active: "person" },
] as const;
export function TabBar() {
  const path = usePathname();
  const router = useRouter();
  const theme = useEntryTheme();
  const insets = useSafeAreaInsets();
  const haptic = useHaptics();
  const reduced = useMotionSetting();
  const pending = useRef<string | null>(null);
  const [width, setWidth] = useState(0);
  const index = tabs.findIndex(tab => path === tab.route || path.startsWith(tab.route + "/"));
  const x = useSharedValue(0);
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (index < 0) return;
    const next = index * width / tabs.length;
    if (reduced) { x.set(next); opacity.set(0); opacity.set(withTiming(1, { duration: motion.shortFade })); }
    else x.set(withSpring(next, motion.spring));
    if (pending.current === path) { haptic("tab"); pending.current = null; }
    // Haptic runs only after navigation reaches its target.
  }, [index, path, reduced, width, haptic, x, opacity]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }], opacity: opacity.get() }));
  if (index < 0) return null;
  // Website mobile nav is a floating, rounded, translucent card with a compact active marker.
  // Preserve existing native routes until the corresponding website tabs have real native screens.
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ backgroundColor: theme.glassFill, marginHorizontal: 8 + Math.max(insets.left, insets.right), marginBottom: Math.max(6, insets.bottom), borderWidth: 1, borderColor: theme.border, borderRadius: 16, overflow: "hidden", shadowColor: "#000000", shadowOpacity: theme.dark ? 0.2 : 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, height: 3, width: width / tabs.length, backgroundColor: theme.button }, indicator]} />
    <View accessibilityRole="tablist" style={{ flexDirection: "row" }}>{tabs.map((tab, i) => <Pressable key={tab.route} accessibilityRole="tab" accessibilityState={{ selected: index === i }} accessibilityLabel={tab.label} onPress={() => { if (i !== index) { pending.current = tab.route; router.navigate(tab.route); } }} style={{ flex: 1, minHeight: 54, justifyContent: "center", alignItems: "center", gap: 3 }}>
      <Ionicons name={index === i ? tab.active : tab.icon} size={24} color={index === i ? theme.accent : theme.muted} />
      <Text style={{ fontSize: 10, fontWeight: "600", color: index === i ? theme.accent : theme.muted }}>{tab.label}</Text>
    </Pressable>)}</View>
  </View>;
}
