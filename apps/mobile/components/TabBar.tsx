import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useHaptics } from "../src/native/haptics";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { GlassCard } from "./glass/GlassCard";
import { glassTokens as glass } from "../src/glassTheme";

const tabs = [
  { route: "/dashboard", label: "Home", icon: "home-outline", active: "home" },
  { route: "/feed", label: "HoopFeed", icon: "flame-outline", active: "flame" },
  { route: "/search", label: "Search", icon: "search-outline", active: "search" },
  { route: "/notifications", label: "Alerts", icon: "notifications-outline", active: "notifications" },
  { route: "/account", label: "Account", icon: "person-outline", active: "person" },
] as const;

/** One floating navigation component for all five existing routes. */
export function GlassTabBar() {
  const path = usePathname();
  const router = useRouter();
  const haptic = useHaptics();
  const insets = useSafeAreaInsets();
  const { account } = useNativeAccount();
  const pending = useRef<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (pending.current === path) { haptic("tab"); pending.current = null; }
  }, [path, haptic]);
  if (keyboardVisible || ["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/auth/callback", "/choose-username"].includes(path)) return null;
  const index = path === "/reels" || path === "/fan-feed" ? 1
    : tabs.findIndex(tab => path === tab.route || path.startsWith(tab.route + "/"));
  return <View pointerEvents="box-none" testID="glass-floating-tab-bar" style={{
    position: "absolute", left: 16 + insets.left, right: 16 + insets.right,
    bottom: Math.max(8, insets.bottom + 6), zIndex: 20,
    shadowColor: "#000000", shadowOpacity: .45, shadowRadius: 20, shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  }}>
    <GlassCard radius={999} padding={5}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", alignItems: "center" }}>
        {tabs.map((tab, i) => {
          const selected = i === index;
          return <Pressable key={tab.route} testID={`tab-${tab.label.toLowerCase()}`}
            accessibilityRole="tab" accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => { if (path !== tab.route) { pending.current = tab.route; router.navigate(tab.route); } }}
            style={{ flex: 1, minWidth: 0, minHeight: 67, alignItems: "center", justifyContent: "center", gap: 4 }}>
            <View style={{ width: 37, height: 37, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: selected ? glass.orange : "transparent" }}>
              <Ionicons name={selected ? tab.active : tab.icon} size={21} color={selected ? "#FFFFFF" : glass.tertiary} />
            </View>
            <Text numberOfLines={1} style={{ color: selected ? "#FFFFFF" : glass.tertiary, fontSize: 10, fontWeight: selected ? "800" : "600" }}>
              {tab.route === "/feed" && account?.user.accountType === "fan" ? "FAN HQ" : tab.label}
            </Text>
          </Pressable>;
        })}
      </View>
    </GlassCard>
  </View>;
}
export const TabBar = GlassTabBar;
