import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Keyboard, PanResponder, Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHaptics } from "../src/native/haptics";
import { useEntryTheme } from "../src/theme";

const tabs = [
  { route: "/dashboard", label: "Home", icon: "home-outline", active: "home" },
  { route: "/feed", label: "HoopFeed", icon: "basketball-outline", active: "basketball" },
  { route: "/search", label: "Search", icon: "compass-outline", active: "compass" },
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
  const pending = useRef<string | null>(null);
  const [width, setWidth] = useState(0);
  const directory = /^\/(teams|players|coaches|leagues|womens)(\/|$)/.test(path);
  // Keep the owning destination highlighted on related screens without changing routes.
  const community = /^\/(reels|fan-feed|feed-welcome|hoopgroups)(\/|$)/.test(path) || /^\/team-hub\/groups(\/|$)/.test(path);
  const account = /^\/(settings|membership|connections|about)(\/|$)/.test(path);
  const index = community ? 1 : /^\/messages(\/|$)/.test(path) ? 3 : path === "/fan-live" ? 0 : account ? 4 : directory ? 2 : tabs.findIndex(tab => path === tab.route || path.startsWith(tab.route + "/"));
  useEffect(() => {
    if (pending.current === path) {
      pending.current = null;
      haptic("tab");
    }
  }, [path, haptic]);
  // PanResponder registers callbacks; pending.current is written only on gesture release.
  // eslint-disable-next-line react-hooks/refs
  const slide = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, g) => width > 0 && index >= 0 && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_event, g) => {
      if (width <= 0 || index < 0) return;
      const segment = width / tabs.length;
      const destination = Math.max(0, Math.min(tabs.length - 1, index + Math.round(g.dx / segment)));
      if (destination !== index) { pending.current = tabs[destination].route; router.navigate(tabs[destination].route); }
    },
  }), [width, index, router]);
  if (keyboardVisible) return null;
  if (["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/auth/callback", "/choose-username", "/pre-sign", "/link-unavailable", "/legal"].includes(path)) return null;
  const translucent = Platform.OS === "ios" && !reduceTransparency;
  const nativeGlass = translucent && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const activeWidth = width > 0 ? width / tabs.length : 0;
  // Only screens with explicit scroll clearance use the overlay. Form/chat routes
  // retain in-flow navigation until their input surfaces are migrated.
  const floating = ["/dashboard", "/fan-feed", "/reels", "/search", "/teams", "/coaches", "/leagues", "/womens"].includes(path) || (path !== "/womens/leagues" && /^\/(players|teams|leagues|womens)\/[^/]+$/.test(path)) || /^\/womens\/leagues\/[^/]+$/.test(path);
  return <View testID="native-tab-bar" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{
      ...(floating ? { position: "absolute" as const, left: 0, right: 0, bottom: 0, zIndex: 40 } : {}),
      marginHorizontal: 16 + Math.max(insets.left, insets.right),
      marginBottom: Math.max(9, insets.bottom), borderRadius: 27,
      borderCurve: "continuous", overflow: "hidden",
      backgroundColor: theme.surface,
      borderWidth: nativeGlass ? 0 : StyleSheet.hairlineWidth, borderColor: theme.dark ? "rgba(255,255,255,.18)" : "rgba(30,42,70,.14)",
      shadowColor: "#000", shadowOffset: { width: 0, height: 14 },
      shadowOpacity: nativeGlass ? 0 : theme.dark ? .20 : .09, shadowRadius: 14, elevation: 12,
    }}>
    {nativeGlass ? <GlassView pointerEvents="none" accessible={false} glassEffectStyle="regular" style={[StyleSheet.absoluteFill, { borderRadius: 27 }]} /> :
      translucent ? <BlurView pointerEvents="none" accessible={false} intensity={80}
        tint={theme.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : null}
    {index >= 0 && activeWidth > 0 ? <View pointerEvents="none" style={{
      position: "absolute", left: index * activeWidth + 8, top: 5, bottom: 5,
      width: Math.max(0, activeWidth - 16), borderRadius: 20,
      backgroundColor: theme.dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.07)",
    }} /> : null}
    <View {...slide.panHandlers} accessibilityRole="tablist" style={{ flexDirection: "row", paddingVertical: 4 }}>
      {tabs.map((tab, i) => {
        const selected = index === i;
        const label = tab.label;
        return <Pressable key={tab.route} testID={`tab-${tab.label.toLowerCase()}`}
          accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={label}
          onPress={() => { if (path !== tab.route) { pending.current = tab.route; router.navigate(tab.route); } }}
          style={({ pressed }) => ({
            flex: 1, minWidth: 0, minHeight: 52,
            paddingVertical: 3, alignItems: "center", justifyContent: "center",
            gap: 4, opacity: pressed ? .82 : 1,
          })}>
            <Ionicons name={selected ? tab.active : tab.icon} size={22}
              color={selected ? theme.accent : theme.muted} />
            <Text numberOfLines={1} style={{
              fontFamily: theme.type.ui.fontFamily, fontSize: 11,
              fontWeight: selected ? "700" : "500",
              color: selected ? theme.accent : theme.dark ? "#E7EFFA" : theme.muted,
            }}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
