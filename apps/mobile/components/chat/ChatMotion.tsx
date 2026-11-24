import { useEffect, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useMotionSetting } from "../../src/motion/Provider";
import { useEntryTheme } from "../../src/theme";
import { confirmedMessageMotion, type MessageMotionSnapshot, type ConfirmedMessage } from "../../src/native/chatMotion";

const emptyIds = new Set<string>();
export function useConfirmedMessageMotion(scope: string, rows: readonly (ConfirmedMessage & { request_id?: string })[], active: boolean, requestId?: string) {
  const previous = useRef<MessageMotionSnapshot | null>(null);
  const [result, setResult] = useState<MessageMotionSnapshot | null>(null);
  useEffect(() => {
    const visible = requestId === undefined ? rows : rows.filter(row => row.request_id === requestId);
    const next = confirmedMessageMotion(previous.current, scope, visible, active);
    previous.current = next;
    setResult(next);
  }, [scope, rows, active, requestId]);
  return active && result?.scope === scope ? result.fresh : emptyIds;
}

/** Only animate NEW verified messages; the initial history must remain static. */
export function ChatMessageEnter({ children, fresh, incoming, active = true }: {
  children: ReactNode; fresh: boolean; incoming: boolean; active?: boolean;
}) {
  const reduced = useMotionSetting();
  const progress = useSharedValue(fresh && active && !reduced ? 0 : 1);
  useEffect(() => {
    cancelAnimation(progress);
    if (fresh && active && !reduced) {
      progress.set(0);
      progress.set(withTiming(1, { duration: incoming ? 320 : 160 }));
    } else progress.set(1);
    return () => cancelAnimation(progress);
  }, [fresh, incoming, active, reduced, progress]);
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p,
      transform: [
        { translateX: incoming ? (1 - p) * -22 : 0 },
        { translateY: incoming ? (1 - p) * 8 - Math.sin(Math.PI * p) * 12 : (1 - p) * 8 },
      ],
    };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Shared bouncing basketball for a LOCAL draft. No peer typing status is
 * inferred from message delivery or presence: remote typing requires verified
 * typing data and can opt into this component when that exists.
 */
export function ChatTypingBasketball({ active, label = "Composing a message" }: {
  active: boolean; label?: string;
}) {
  const reduced = useMotionSetting();
  const theme = useEntryTheme();
  const bounce = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(bounce);
    if (active && !reduced) {
      bounce.set(withRepeat(withSequence(
        withTiming(1, { duration: 240 }),
        withTiming(0, { duration: 240 }),
      ), -1, false));
    } else bounce.set(0);
    return () => cancelAnimation(bounce);
  }, [active, reduced, bounce]);
  const ball = useAnimatedStyle(() => ({
    transform: [{ translateY: -5 * bounce.get() },
      { rotateZ: `${bounce.get() * 14}deg` }],
  }));
  if (!active) return null;
  return <View accessible accessibilityLabel={label} style={{
    flexDirection: "row", alignItems: "center", gap: 5, minHeight: 22,
  }}>
    <Animated.View pointerEvents="none" style={ball}>
      <Ionicons name="basketball-outline" size={15} color={theme.accent} />
    </Animated.View>
    <Text style={{ color: theme.muted, fontSize: 11 }}>Drafting</Text>
  </View>;
}
