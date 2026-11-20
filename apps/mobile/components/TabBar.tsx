import { useMotionSetting } from "../src/motion/Provider";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { motion } from "../src/motion/config";
import { useHaptics } from "../src/native/haptics";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";

const tabs = [
  { route: "/dashboard", label: "Home", icon: "home-outline", active: "home" },
  { route: "/feed", label: "HoopFeed", icon: "basketball-outline", active: "basketball" },
  { route: "/search", label: "Search", icon: "search-outline", active: "search" },
  { route: "/notifications", label: "Alerts", icon: "notifications-outline", active: "notifications" },
  { route: "/account", label: "Account", icon: "person-circle-outline", active: "person-circle" },
] as const;
export function TabBar() {
  const path = usePathname();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const router = useRouter();
  const theme = useEntryTheme();
  const insets = useSafeAreaInsets();
  const haptic = useHaptics();
  const reduced = useMotionSetting();
  const { account } = useNativeAccount();
  const pending = useRef<string | null>(null);
  const [width, setWidth] = useState(0);
  const index = path === "/reels" || path === "/fan-feed" ? 1 : tabs.findIndex(tab => path === tab.route || path.startsWith(tab.route + "/"));
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
  if (keyboardVisible) return null;
  if (["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/auth/callback", "/choose-username"].includes(path)) return null;
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ backgroundColor: theme.surface, marginHorizontal: 8 + Math.max(insets.left, insets.right), marginBottom: Math.max(6, insets.bottom), borderRadius: theme.radius.card, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderColor: theme.border }}>
    {index >= 0 ? <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, height: 3, width: width / tabs.length * .56, marginLeft: width / tabs.length * .22, backgroundColor: theme.button }, indicator]} /> : null}
    <View accessibilityRole="tablist" style={{ flexDirection: "row" }}>{tabs.map((tab, i) => <Pressable key={tab.route} testID={`tab-${tab.label.toLowerCase()}`} accessibilityRole="tab" accessibilityState={{ selected: index === i }} accessibilityLabel={tab.label} onPress={() => { if (path !== tab.route) { pending.current = tab.route; router.navigate(tab.route); } }} style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 60, paddingVertical: 6, justifyContent: "center", alignItems: "center", gap: 3, opacity: pressed ? .65 : 1 })}>

      <Ionicons name={index === i ? tab.active : tab.icon} size={24} color={index === i ? theme.accent : theme.muted} />
      <Text style={{ fontSize: 11, fontWeight: "600", color: index === i ? theme.accent : theme.muted }}>{tab.route === "/feed" && account?.user.accountType === "fan" ? "FAN HQ" : tab.label}</Text>
    </Pressable>)}</View>
  </View>;
}
