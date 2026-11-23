import { useEffect, useRef } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { cancelAnimation, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { BrandLogo } from "../BrandLogo";
import { useMotionSetting } from "../../src/motion/Provider";
import { GlassCard } from "./GlassCard";
import { glassTokens as glass } from "../../src/glassTheme";

/**
 * Build 11 glass stays the only header design. For Home, a UI-thread scroll
 * value collapses the same glass pill without introducing an opaque Build 9 bar.
 * Other screens get their original static GlassHeader and Alerts behavior.
 * Inset is applied exactly once; never render inside a top SafeAreaView.
 */
type SearchHeaderProps = {
  homeScrollY?: SharedValue<number>;
  searchOpen?: boolean;
  onSearchOpen?: () => void;
  onSearchCancel?: () => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  onSearchSubmit?: () => void;
  onSearchBlur?: () => void;
};

/** Search expands inside the same glass pill. The search screen owns results. */
export function GlassHeader({
  homeScrollY, searchOpen = false, onSearchOpen, onSearchCancel,
  searchTerm = "", onSearchTermChange, onSearchSubmit, onSearchBlur,
}: SearchHeaderProps = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduced = useMotionSetting();
  const inputRef = useRef<TextInput>(null);
  const searchProgress = useSharedValue(searchOpen ? 1 : 0);
  useEffect(() => {
    cancelAnimation(searchProgress);
    searchProgress.set(reduced ? (searchOpen ? 1 : 0) :
      withTiming(searchOpen ? 1 : 0, { duration: 150 }));
    return () => cancelAnimation(searchProgress);
  }, [searchOpen, reduced, searchProgress]);
  useEffect(() => {
    if (!searchOpen) { inputRef.current?.blur(); return; }
    const timer = setTimeout(() => inputRef.current?.focus(), reduced ? 0 : 150);
    return () => clearTimeout(timer);
  }, [searchOpen, reduced]);
  const searchStyle = useAnimatedStyle(() => ({
    opacity: searchProgress.get(),
    transform: [{ translateX: (1 - searchProgress.get()) * 10 }],
  }));
  const pillGrow = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + searchProgress.get() * 0.015 }],
  }));
  const headerStyle = useAnimatedStyle(() => {
    const offset = searchOpen ? 0 : homeScrollY?.get() ?? 0;
    const short = reduced ? (offset > 55 ? 4 : 8) :
      interpolate(offset, [0, 100], [8, 4], Extrapolation.CLAMP);
    return { paddingTop: insets.top + short, paddingBottom: short };
  });
  const pillStyle = useAnimatedStyle(() => {
    const offset = searchOpen ? 0 : homeScrollY?.get() ?? 0;
    return { height: searchOpen || !homeScrollY ? 46 : reduced ? (offset > 55 ? 40 : 46) :
      interpolate(offset, [0, 100], [46, 40], Extrapolation.CLAMP) };
  });
  const expandedStyle = useAnimatedStyle(() => {
    const offset = searchOpen ? 0 : homeScrollY?.get() ?? 0;
    return {
      opacity: (1 - searchProgress.get()) * (!homeScrollY ? 1 : reduced ? (offset > 55 ? 0 : 1) :
        interpolate(offset, [0, 65], [1, 0], Extrapolation.CLAMP)),
      transform: [{ scale: !homeScrollY || reduced ? 1 :
        interpolate(offset, [0, 100], [1, 0.85], Extrapolation.CLAMP) }],
    };
  });
  const compactStyle = useAnimatedStyle(() => {
    const offset = searchOpen ? 0 : homeScrollY?.get() ?? 0;
    return { opacity: (1 - searchProgress.get()) * (!homeScrollY ? 0 : reduced ? (offset > 55 ? 1 : 0) :
      interpolate(offset, [35, 90], [0, 1], Extrapolation.CLAMP)) };
  });
  return <Animated.View testID="glass-safe-header" style={[
    { paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8,
      zIndex: homeScrollY ? 30 : 3 },
    homeScrollY ? { position: "absolute", top: 0, left: 0, right: 0 } : null,
    headerStyle,
  ]}>
    <Animated.View style={pillGrow}><GlassCard radius={999} padding={8}>
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
        {onSearchOpen ? <Animated.View style={{ marginLeft: "auto", opacity: searchOpen ? 0 : 1 }}
          pointerEvents={searchOpen ? "none" : "auto"}><Pressable accessibilityRole="button"
            accessibilityLabel="Search" onPress={onSearchOpen}
            style={{ width: 44, height: 44, borderRadius: 22,
              alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="search-outline" size={23} color={glass.foreground} />
          </Pressable></Animated.View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Alerts"
          pointerEvents={searchOpen ? "none" : "auto"}
          accessibilityState={{ disabled: searchOpen }}
          onPress={() => router.push("/notifications")}
          style={{ width: 44, height: 44, borderRadius: 22, marginLeft: "auto",
            alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="notifications-outline" size={23} color={glass.foreground} />
          <View pointerEvents="none" accessible={false}
            style={{ position: "absolute", right: 9, top: 8, width: 7, height: 7,
              borderRadius: 4, backgroundColor: glass.orange }} />
        </Pressable>
        <Animated.View pointerEvents={searchOpen ? "auto" : "none"}
          accessibilityElementsHidden={!searchOpen}
          importantForAccessibility={searchOpen ? "auto" : "no-hide-descendants"}
          style={[{ position: "absolute", left: 9, right: 0, top: 0, bottom: 0,
            flexDirection: "row", alignItems: "center", gap: 6 }, searchStyle]}>
          <Ionicons name="search-outline" size={20} color={glass.orange} />
          <TextInput ref={inputRef} accessibilityLabel="Search basketball directory"
            placeholder="Search basketball…" placeholderTextColor={glass.tertiary}
            autoCapitalize="none" autoCorrect={false} returnKeyType="search"
            editable={searchOpen} maxLength={100} value={searchTerm}
            onChangeText={onSearchTermChange} onSubmitEditing={onSearchSubmit}
            onBlur={onSearchBlur}
            style={{ flex: 1, minWidth: 0, minHeight: 44, color: glass.foreground,
              fontSize: 14, paddingVertical: 5 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel search"
            onPress={() => { Keyboard.dismiss(); onSearchCancel?.(); }}
            style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: "center" }}>
            <Text style={{ color: glass.orange, fontSize: 13, fontWeight: "700" }}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </GlassCard></Animated.View>
  </Animated.View>;
}
