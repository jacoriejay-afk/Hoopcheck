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
  if (["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/auth/callback", "/choose-username"].includes(path)) return null;
  const translucent = Platform.OS === "ios" && !reduceTransparency;
  const nativeGlass = translucent && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const activeWidth = width > 0 ? width / tabs.length : 0;
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{
      marginHorizontal: 9 + Math.max(insets.left, insets.right),
      marginBottom: Math.max(6, insets.bottom), borderRadius: 25,
      borderCurve: "continuous", overflow: "hidden",
      backgroundColor: translucent ? theme.glassFill : (theme.dark ? "#101F33" : theme.surface),
      borderWidth: 1, borderColor: theme.dark ? "rgba(126,171,229,.50)" : "#D8D5D5",
      shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
      shadowOpacity: theme.dark ? .3 : .12, shadowRadius: 18, elevation: 8,
    }}>
    {nativeGlass ? <GlassView pointerEvents="none" accessible={false} glassEffectStyle="regular"
      tintColor={theme.dark ? "#20334A" : "#EAF1FB"} style={[StyleSheet.absoluteFill, { borderRadius: 25 }]} /> :
      translucent ? <BlurView pointerEvents="none" accessible={false} intensity={65}
        tint={theme.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : null}
    <LinearGradient pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}
      colors={theme.dark ? ["rgba(83,137,212,.18)", "rgba(255,111,41,.08)"] : ["rgba(255,255,255,.90)", "rgba(255,223,193,.25)"]}
      start={{ x: 0, y: 0 }} end={{ x: .2, y: 1 }} />
    {index >= 0 && activeWidth > 0 ? <Animated.View pointerEvents="none" style={[{
      position: "absolute", left: 4, top: 4, bottom: 4,
      width: Math.max(0, activeWidth - 8), borderRadius: 19, borderCurve: "continuous",
      backgroundColor: theme.dark ? "rgba(255,112,39,.22)" : "rgba(255,121,43,.13)",
      borderWidth: 1, borderColor: theme.dark ? "#FC8E43" : "rgba(206,83,28,.40)",
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
              color={selected ? theme.accent : theme.muted} />
            <Text numberOfLines={1} style={{
              fontFamily: theme.type.ui.fontFamily, fontSize: 10,
              fontWeight: selected ? "700" : "500",
              color: selected ? theme.accent : theme.dark ? "#E7EFFA" : theme.muted,
            }}>{label}</Text>
            {selected ? <View pointerEvents="none" accessible={false}
              style={{position:"absolute",bottom:1,height:3,width:24,borderRadius:3,
                backgroundColor:theme.accent}}/> : null}
          </>}
        </Pressable>;
      })}
    </View>
  </View>;
}
