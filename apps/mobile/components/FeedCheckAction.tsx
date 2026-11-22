import { useEffect, useRef } from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { motion } from "../src/motion/config";
import { useEntryTheme } from "../src/theme";

/** Visual feedback only: the parent owns the verified Check API and membership gates. */
export function FeedCheckAction({ checked, count, disabled, busy, onPress }: {
  checked: boolean | undefined;
  count: number | undefined;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const theme = useEntryTheme();
  const reduced = useMotionSetting();
  const last = useRef<boolean | undefined>(undefined);
  const scale = useSharedValue(1);
  useEffect(() => {
    const before = last.current;
    last.current = checked;
    cancelAnimation(scale);
    // Never celebrate initial loads or an unverified/failed Check request.
    if (reduced || before !== false || checked !== true) {
      scale.set(1);
    } else {
      scale.set(withSequence(withTiming(1.16, { duration: 120 }), withSpring(1, motion.spring)));
    }
    return () => cancelAnimation(scale);
  }, [checked, reduced, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const selected = checked === true;
  const available = checked !== undefined && count !== undefined;
  return <Pressable accessibilityRole="button"
    accessibilityLabel={available ? `${selected ? "Remove Check" : "Check post"}, ${count} Checks` : "Checks unavailable"}
    accessibilityState={{ selected, disabled: disabled || !available || busy, busy }}
    disabled={disabled || !available || busy} onPress={onPress}
    style={({ pressed }) => ({
      flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44,
      paddingHorizontal: 11, borderRadius: theme.radius.pill,
      backgroundColor: selected ? theme.accentSurface : theme.chip,
      borderWidth: selected ? 1 : 0, borderColor: theme.accent,
      opacity: pressed ? .76 : disabled ? .6 : 1,
    })}>
    <Animated.View pointerEvents="none" style={animated}>
      <Ionicons name={selected ? "arrow-up-circle" : "arrow-up-circle-outline"}
        color={selected ? theme.accent : theme.muted} size={18} />
    </Animated.View>
    <Text style={{ color: selected ? theme.accent : theme.foreground, fontSize: 13,
      fontWeight: "700", fontVariant: ["tabular-nums"] }}>
      {!available ? "Checks unavailable" : `${selected ? "Checked" : "Check"} · ${count}`}
    </Text>
  </Pressable>;
}
