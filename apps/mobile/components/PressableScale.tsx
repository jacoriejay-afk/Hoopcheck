import type { ReactNode } from "react";
import * as Haptics from "expo-haptics";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";

type Props = Omit<PressableProps, "children"> & {
  children: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Home-only tactile target. Press recognition is delayed so a ScrollView can
 * claim a drag before the spring fires. Haptics occur only on completed taps.
 * This is not a responder on the scroll container.
 */
export function PressableScale({
  children, containerStyle, onPress, onPressIn, onPressOut, disabled,
  unstable_pressDelay = 160, ...props
}: Props) {
  const reduced = useMotionSetting();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const spring = {
    damping: 15,
    stiffness: 300,
    mass: 1,
    reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.System,
  } as const;

  return <Animated.View style={[containerStyle, animatedStyle]}>
    <Pressable {...props} disabled={disabled} unstable_pressDelay={unstable_pressDelay}
      onPress={event => {
        // Only a completed tap is recognized: drags cancelled by ScrollView never vibrate.
        if (!disabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(event);
      }}
      onPressIn={event => {
        if (!disabled) {
          scale.set(reduced ? 1 : withSpring(0.97, spring));
        }
        onPressIn?.(event);
      }}
      onPressOut={event => {
        scale.set(reduced ? 1 : withSpring(1, spring));
        onPressOut?.(event);
      }}>
      {children}
    </Pressable>
  </Animated.View>;
}
