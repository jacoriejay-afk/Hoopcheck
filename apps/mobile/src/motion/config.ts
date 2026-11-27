import { Easing, ReduceMotion } from "react-native-reanimated";

// Transform/opacity only. All animated surfaces share the same UI-thread policy.
export const motion = {
  menuReveal: 180,
  progress: 180,
  fade: 160,
  shortFade: 80,
  logo: 500,
  splashDeadline: 1500,
  skeletonDelay: 300,
  shimmer: 1100,
  shimmerWidth: 64,
  stagger: 24,
  maxStagger: 8,
  searchDelay: 250,
  spring: { damping: 22, stiffness: 260, mass: 0.8, reduceMotion: ReduceMotion.System },
  easeOut: Easing.bezier(0.23, 1, 0.32, 1),
  timing: { duration: 160, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System },
} as const;
