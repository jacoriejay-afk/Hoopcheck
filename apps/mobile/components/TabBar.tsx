import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { useMotionSetting } from "../src/motion/Provider";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Keyboard, Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { motion } from "../src/motion/config";
import { useHaptics } from "../src/native/haptics";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";

const tabs = [
  { route: "/dashboard", label: "Home", icon: "home-outline", active: "home" },
  { route: "/feed", label: "HoopFeed", icon: "flame-outline", active: "flame" },
  { route: "/search", label: "Search", icon: "search-outline", active: "search" },
  { route: "/notifications", label: "Alerts", icon: "notifications-outline", active: "notifications" },
  { route: "/account", label: "Account", icon: "person-outline", active: "person" },
] as const;
type NavIcon = (typeof tabs)[number]["icon"] | (typeof tabs)[number]["active"];
function AnimatedTabIcon({ selected, pressed, reduced, icon, active, size, color }: {
  selected: boolean; pressed: boolean; reduced: boolean; icon: NavIcon; active: NavIcon; size: number; color: string;
}) {
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduced) { scale.set(1); lift.set(0); return; }
    scale.set(pressed ? withTiming(.90, { duration: 90 }) : selected
      ? withSequence(withTiming(1.18, { duration: 120 }), withSpring(1.07, motion.spring))
      : withSpring(1, motion.spring));
    lift.set(withSpring(selected && !pressed ? -2 : 0, motion.spring));
  }, [selected, pressed, reduced, scale, lift]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }, { scale: scale.get() }] }));
  return <Animated.View style={animated} pointerEvents="none"><Ionicons name={selected ? active : icon} size={size} color={color} /></Animated.View>;
}
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
  if (path === "/reels/studio") return null;
  if (["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/auth/callback", "/choose-username"].includes(path)) return null;
  const translucent = Platform.OS === "ios" && !reduceTransparency;
  const nativeGlass = translucent && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const activeWidth = width > 0 ? width / tabs.length : 0;
  // Only the four glass screens reserve scroll-bottom space for an overlay.
  // Other existing Build 9 routes keep the tab bar in the normal layout.
  const floating = ["/dashboard", "/fan-live", "/feed", "/fan-feed", "/reels"].includes(path)
    || (path.startsWith("/teams/") && path.split("/").length === 3);
  return <View testID="glass-floating-tab-bar" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{
      position: floating ? "absolute" : "relative", left: 0, right: 0, bottom: 0, zIndex: 20,
      marginHorizontal: 16 + Math.max(insets.left, insets.right),
      marginBottom: Math.max(8, insets.bottom + 6), borderRadius: 999,
      borderCurve: "continuous", overflow: "hidden",
      backgroundColor: translucent ? theme.glassFill : theme.surface,
      borderWidth: 1, borderColor: theme.glassBorder,
      shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
      shadowOpacity: theme.dark ? .3 : .12, shadowRadius: 18, elevation: 8,
    }}>
    {nativeGlass ? <GlassView pointerEvents="none" accessible={false} glassEffectStyle="regular"
      tintColor={theme.dark ? "#20334A" : "#EAF1FB"} style={[StyleSheet.absoluteFill, { borderRadius: 999 }]} /> :
      translucent ? <BlurView pointerEvents="none" accessible={false} intensity={55}
        tint={theme.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : null}
    <LinearGradient pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}
      colors={["rgba(255,255,255,.10)", "rgba(255,255,255,0.01)"]}
      start={{ x: 0, y: 0 }} end={{ x: .2, y: 1 }} />
    {index >= 0 && activeWidth > 0 ? <Animated.View pointerEvents="none" style={[{
      position: "absolute", left: Math.max(0, (activeWidth - 38) / 2), top: 5,
      width: 38, height: 38, borderRadius: 19, borderCurve: "continuous",
      backgroundColor: theme.button,
      borderWidth: 0, borderColor: theme.button,
      shadowColor: "#FF712E", shadowOpacity: theme.dark ? .4 : .13,
      shadowRadius: 9, shadowOffset: { width: 0, height: 2 },
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
            paddingVertical: 5, alignItems: "center", justifyContent: "center",
            gap: 3, opacity: pressed ? .82 : 1,
          })}>
          {({ pressed }) => <>
            <AnimatedTabIcon selected={selected} pressed={pressed} reduced={reduced}
              icon={tab.icon} active={tab.active} size={theme.courtside.navigation.iconSize}
              color={selected ? "#FFFFFF" : theme.muted} />
            <Text numberOfLines={1} style={{
              fontFamily: theme.type.ui.fontFamily, fontSize: 10,
              fontWeight: selected ? "700" : "500",
              color: selected ? "#FFFFFF" : theme.muted,
            }}>{label}</Text>
            
          </>}
        </Pressable>;
      })}
    </View>
  </View>;
}
