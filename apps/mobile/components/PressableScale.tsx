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
 * claim a drag before either the spring or the haptic fires.
 * This is not a responder on the scroll container.
 */
export function PressableScale({
  children, containerStyle, onPressIn, onPressOut, disabled,
  unstable_pressDelay = 160, ...props
}: Props) {
  const reduced = useMotionSetting();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const spring = {
    damping: 15,
    stiffness: 300,
    mass: 1,
    reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.System,
  } as const;

  return <Animated.View style={[containerStyle, animatedStyle]}>
    <Pressable {...props} disabled={disabled} unstable_pressDelay={unstable_pressDelay}
      onPressIn={event => {
        if (!disabled) {
          scale.value = reduced ? 1 : withSpring(0.97, spring);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPressIn?.(event);
      }}
      onPressOut={event => {
        scale.value = reduced ? 1 : withSpring(1, spring);
        onPressOut?.(event);
      }}>
      {children}
    </Pressable>
  </Animated.View>;
}
