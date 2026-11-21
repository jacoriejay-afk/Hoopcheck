import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useMotionSetting } from "../src/motion/Provider";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Keyboard, Pressable, Text, View } from "react-native";
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
  // Start opaque until the accessibility preference is known.
  const [reduceTransparency, setReduceTransparency] = useState(true);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (active) setReduceTransparency(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduceTransparency);
    return () => { active = false; subscription.remove(); };
  }, []);
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
  const translucent = Platform.OS === "ios" && !reduceTransparency;
  const activeWidth = width > 0 ? width / tabs.length : 0;
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{
      marginHorizontal: 12 + Math.max(insets.left, insets.right),
      marginBottom: Math.max(8, insets.bottom), borderRadius: 32,
      borderCurve: "continuous", overflow: "hidden",
      backgroundColor: translucent ? theme.glassFill : theme.surface,
      borderWidth: 1, borderColor: translucent ? theme.glassBorder : theme.border,
      shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
      shadowOpacity: theme.dark ? .38 : .17, shadowRadius: 28, elevation: 12,
    }}>
    {translucent ? <BlurView pointerEvents="none" accessible={false} intensity={65}
      tint={theme.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : null}
    <LinearGradient pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}
      colors={theme.dark ? ["rgba(255,255,255,.13)", "rgba(255,255,255,.02)"] : ["rgba(255,255,255,.8)", "rgba(255,255,255,.15)"]}
      start={{ x: 0, y: 0 }} end={{ x: .2, y: 1 }} />
    {index >= 0 && activeWidth > 0 ? <Animated.View pointerEvents="none" style={[{
      position: "absolute", left: 5, top: 6, bottom: 6,
      width: Math.max(0, activeWidth - 10), borderRadius: 25, borderCurve: "continuous",
      backgroundColor: theme.dark ? "rgba(255,143,85,.18)" : "rgba(255,126,70,.15)",
      borderWidth: 1, borderColor: theme.dark ? "rgba(255,165,111,.45)" : "rgba(206,83,28,.3)",
    }, indicator]} /> : null}
    <View accessibilityRole="tablist" style={{ flexDirection: "row", paddingVertical: 1 }}>
      {tabs.map((tab, i) => {
        const selected = index === i;
        const label = tab.route === "/feed" && account?.user.accountType === "fan" ? "FAN HQ" : tab.label;
        return <Pressable key={tab.route} testID={`tab-${tab.label.toLowerCase()}`}
          accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={label}
          onPress={() => { if (path !== tab.route) { pending.current = tab.route; router.navigate(tab.route); } }}
          style={({ pressed }) => ({
            flex: 1, minWidth: 0, minHeight: theme.courtside.navigation.height,
            paddingVertical: 8, alignItems: "center", justifyContent: "center",
            gap: 5, opacity: pressed ? .64 : 1,
          })}>
          <Ionicons name={selected ? tab.active : tab.icon} size={theme.courtside.navigation.iconSize + (selected ? 1 : 0)}
            color={selected ? theme.accent : theme.muted} />
          <Text numberOfLines={1} style={{
            fontSize: 10, fontWeight: selected ? "800" : "600", letterSpacing: selected ? .05 : 0,
            color: selected ? theme.foreground : theme.muted,
          }}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
