import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { BrandLogo } from "../BrandLogo";
import { useMotionSetting } from "../../src/motion/Provider";
import { GlassCard } from "./GlassCard";
import { GlassSurface } from "../GlassSurface";
import { glassTokens as glass } from "../../src/glassTheme";

/**
 * Build 11 glass stays the only header design. For Home, a UI-thread scroll
 * value collapses the same glass pill without introducing an opaque Build 9 bar.
 * Other screens get their original static GlassHeader and Alerts behavior.
 * Inset is applied exactly once; never render inside a top SafeAreaView.
 */
export function GlassHeader({ homeScrollY, feedMode = false, feedReels = false, onFeedTabChange, onFeedGuide }: {
  homeScrollY?: SharedValue<number>;
  feedMode?: boolean;
  feedReels?: boolean;
  onFeedTabChange?: (reels: boolean) => void;
  onFeedGuide?: () => void;
} = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduced = useMotionSetting();
  const headerStyle = useAnimatedStyle(() => {
    const offset = homeScrollY?.get() ?? 0;
    const short = reduced ? (offset > 55 ? 4 : 8) :
      interpolate(offset, [0, 100], [8, 4], Extrapolation.CLAMP);
    return { paddingTop: insets.top + short, paddingBottom: short };
  });
  const pillStyle = useAnimatedStyle(() => {
    const offset = homeScrollY?.get() ?? 0;
    return { height: !homeScrollY ? 46 : reduced ? (offset > 55 ? 40 : 46) :
      interpolate(offset, [0, 100], [46, 40], Extrapolation.CLAMP) };
  });
  const expandedStyle = useAnimatedStyle(() => {
    const offset = homeScrollY?.get() ?? 0;
    return {
      opacity: !homeScrollY ? 1 : reduced ? (offset > 55 ? 0 : 1) :
        interpolate(offset, [0, 65], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: !homeScrollY || reduced ? 1 :
        interpolate(offset, [0, 100], [1, 0.85], Extrapolation.CLAMP) }],
    };
  });
  const compactStyle = useAnimatedStyle(() => {
    const offset = homeScrollY?.get() ?? 0;
    return { opacity: !homeScrollY ? 0 : reduced ? (offset > 55 ? 1 : 0) :
      interpolate(offset, [35, 90], [0, 1], Extrapolation.CLAMP) };
  });
  // HoopFeed has one slim header island instead of the HoopCheck header,
  // a separate tab container and a second page title.
  if (feedMode) return <View testID="feed-compact-header"
    style={{ paddingTop: insets.top + 4, paddingHorizontal: 10, paddingBottom: 4 }}>
    <GlassSurface native intensity={52} style={{
      borderRadius: 999, minHeight: 46, paddingHorizontal: 11,
      flexDirection: "row", alignItems: "center", gap: 5,
    }}>
      <Text accessibilityRole="header" numberOfLines={1}
        style={{ color: glass.foreground, fontFamily: "HoopCheckDisplay", fontSize: 20, flexShrink: 1 }}>
        HOOPFEED
      </Text>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", marginLeft: "auto", gap: 2 }}>
        {[false, true].map(value => <Pressable key={String(value)}
          accessibilityRole="tab" accessibilityLabel={value ? "Reels" : "HoopFeed"}
          accessibilityState={{ selected: feedReels === value }}
          aria-selected={feedReels === value}
          onPress={() => onFeedTabChange?.(value)}
          style={({ pressed }) => ({
            minWidth: 52, minHeight: 44, paddingHorizontal: 6, borderRadius: 20,
            justifyContent: "center", alignItems: "center",
            backgroundColor: feedReels === value ? glass.orange + "28" : "transparent",
            opacity: pressed ? 0.7 : 1,
          })}>
          <Text style={{ color: feedReels === value ? glass.orange : glass.secondary,
            fontSize: 11, fontWeight: "800" }}>{value ? "Reels" : "Posts"}</Text>
        </Pressable>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Meet HoopBot welcome guide"
        onPress={onFeedGuide}
        style={({ pressed }) => ({ width: 36, minHeight: 44, justifyContent: "center",
          alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
        <Ionicons name="help-circle-outline" size={22} color={glass.secondary} />
      </Pressable>
    </GlassSurface>
  </View>;

  return <Animated.View testID="glass-safe-header" style={[
    { paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8,
      zIndex: homeScrollY ? 30 : 3 },
    homeScrollY ? { position: "absolute", top: 0, left: 0, right: 0 } : null,
    headerStyle,
  ]}>
    <GlassCard radius={999} padding={8}>
      <Animated.View style={[{ height: 46, flexDirection: "row", alignItems: "center",
        justifyContent: "space-between", paddingLeft: 9 }, pillStyle]}>
        <Animated.View pointerEvents="none" style={[
          { position: "absolute", left: 9, top: 0, bottom: 0, justifyContent: "center" },
          expandedStyle,
        ]}>
          <BrandLogo />
        </Animated.View>
        {homeScrollY ? <Animated.View pointerEvents="none" accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[{ position: "absolute", left: 9, top: 0, bottom: 0,
            flexDirection: "row", alignItems: "center", gap: 7 }, compactStyle]}>
          <Svg width={30} height={30} viewBox="0 0 100 100" fill="none"
            stroke={glass.foreground} strokeLinecap="square" strokeLinejoin="miter"
            accessible={false}>
            <Path d="M50 5 88 27v35L97 51 78 82 50 96 12 74V27Z" strokeWidth={5.2} />
            <Circle cx={49} cy={49} r={25} strokeWidth={3.4} />
            <Path d="M25 46c15-13 34-13 49-4M27 32c12 17 26 15 44 5M50 24c-13 19-14 41-3 50M49 24c-4 18-2 39 10 49M26 58c14-15 30-12 47 8" strokeWidth={2.8} />
            <Path d="m47 60 14 11 34-42" strokeWidth={7} />
          </Svg>
          <Text style={{ color: glass.foreground, fontSize: 15, fontWeight: "800" }}>HoopCheck</Text>
        </Animated.View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Alerts"
          onPress={() => router.push("/notifications")}
          style={{ width: 44, height: 44, borderRadius: 22, marginLeft: "auto",
            alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="notifications-outline" size={23} color={glass.foreground} />
          <View pointerEvents="none" accessible={false}
            style={{ position: "absolute", right: 9, top: 8, width: 7, height: 7,
              borderRadius: 4, backgroundColor: glass.orange }} />
        </Pressable>
      </Animated.View>
    </GlassCard>
  </Animated.View>;
}