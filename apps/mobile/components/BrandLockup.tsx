import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useEntryTheme } from "../src/theme";
import { useMotionSetting } from "../src/motion/Provider";
import { motion } from "../src/motion/config";

/** Vector redraw of the owner's November 24 shield and orange arrow. */
export function BrandMark({ size = 48, animated = false }: { size?: number; animated?: boolean }) {
  const theme = useEntryTheme();
  const reduced = useMotionSetting();
  const progress = useSharedValue(animated && !reduced ? 0 : 1);
  useEffect(() => {
    cancelAnimation(progress);
    if (animated && !reduced) {
      progress.set(0);
      progress.set(withTiming(1, { ...motion.timing, duration: motion.logo }));
    } else progress.set(1);
    return () => cancelAnimation(progress);
  }, [animated, reduced, progress]);
  const reveal = useAnimatedStyle(() => ({ opacity: 0.25 + progress.get() * 0.75, transform: [{ scale: 0.92 + progress.get() * 0.08 }] }));
  return <Animated.View accessible={false} importantForAccessibility="no-hide-descendants" style={[{ width: size, height: size }, reveal]}>
    <Svg width={size} height={size} viewBox="190 240 720 750">
      <Path d="M505 260 775 426 775 545 732 582 732 451 505 313 260 458 260 764 496 913 706 779 501 971 215 793 215 430Z" fill={theme.foreground} />
      <Ellipse cx={495} cy={606} rx={200} ry={208} fill="none" stroke={theme.foreground} strokeWidth={15} />
      <Path d="M360 450 C418 548 510 510 633 458" fill="none" stroke={theme.foreground} strokeWidth={14} strokeLinecap="round" />
      <Path d="M505 399 C423 507 418 676 497 813" fill="none" stroke={theme.foreground} strokeWidth={14} strokeLinecap="round" />
      <Path d="M298 610 C382 527 570 544 693 621" fill="none" stroke={theme.foreground} strokeWidth={14} strokeLinecap="round" />
      <Path d="M353 756 C337 662 391 595 451 619 C526 622 565 714 636 756" fill="none" stroke={theme.foreground} strokeWidth={14} strokeLinecap="round" />
      <Path d="M891 486 781 793 510 971 743 760 790 630 635 766 671 668Z" fill="#FF6A00" />
    </Svg>
  </Animated.View>;
}

export function BrandLockup({ size = 48, animated = false }: { size?: number; animated?: boolean }) {
  const theme = useEntryTheme();
  return <View accessible accessibilityRole="image" accessibilityLabel="HoopCheck" style={{ flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" }}>
    <BrandMark size={size} animated={animated} />
    <Svg width={size * 3.15} height={size * 0.82} viewBox="0 0 1180 305" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M24,56.1 24,242 56.7,212 56.7,146.8 57.4,145.9 96.1,145.9 97.9,147.7 97,154 97.9,154.7 97.9,212.9 129.7,242 129.7,56.1 97.9,56.1 97,57.9 97.9,117.7 96.1,119.5 57.4,119.5 56.7,118.6 56.7,87.9 55.8,87 56.7,86.1 56.7,57 55.8,56.1Z M214.8,82.3 220,87.5 220,181.5 214.8,186.7 186.8,186.7 180.8,181.5 180.8,87.5 185,83.2Z M169.4,56.1 149.4,74.5 148.5,76.9 148.5,193 168.5,212.9 231.2,212.9 251.3,194.5 251.3,74.5 231.2,56.1Z M336.4,82.3 341.6,87.5 341.6,181.5 336.4,186.7 308.4,186.7 302.4,181.5 302.4,87.5 306.7,83.2Z M291,56.1 271,74.5 270.1,76.9 270.1,193 290.1,212.9 352.8,212.9 373,194.5 373,74.5 352.8,56.1Z M424.9,83.2 457.2,83.2 461.4,87.5 461.4,123.1 455.4,129.3 425.8,129.3 424,127.6 424,83.9Z M472.8,56.1 392.7,56.1 391.8,60.4 392.7,61.3 391.8,63.9 392.7,69.1 391.8,242.5 424,212.9 424,156.2 424.9,155.3 471.9,155.3 492.8,136.3 492.8,74.5Z M531.3,56.1 511.6,74.3 511.6,194.7 530.4,212.9 588.9,212.9 607.7,195.6 607.7,161.2 578.1,161.2 578.1,183.3 573.2,187.4 546.1,187.4 542.1,183.3 542.1,86.6 546.1,82.3 574.1,82.3 578.1,87.2 577.2,93.1 577.2,106.3 578.1,107 606.8,107 607.7,106.3 607.7,74.3 587.1,56.1Z M626.5,56.1 626.5,242 659.2,212 659.2,146.8 659.9,145.9 698.6,145.9 700.4,147.7 699.5,154 700.4,154.7 700.4,212.9 732.2,242 732.2,56.1 700.4,56.1 699.5,57.9 700.4,117.7 698.6,119.5 659.9,119.5 659.2,118.6 659.2,87.9 658.3,87 659.2,86.1 659.2,57 658.3,56.1Z M838.8,56.1 752.6,56.1 751,57 751,240 781.5,212.9 839.7,212.9 839.7,187.4 782.1,187.4 781.5,186.7 781.5,146.4 782.1,145.5 826.5,145.5 827.4,144.8 827.4,120.2 782.1,120.2 781.5,119.3 781.5,86.6 780.6,85.7 782.1,82.3 838.8,82.3Z M878.2,56.1 858.5,74.3 858.5,194.7 877.3,212.9 935.8,212.9 954.6,195.6 954.6,161.2 925,161.2 925,183.3 920.1,187.4 893,187.4 889,183.3 889,86.6 893,82.3 921,82.3 925,87.2 924.1,93.1 924.1,106.3 925,107 953.7,107 954.6,106.3 954.6,74.3 934,56.1Z M973.4,56.1 973.4,242 1005.2,212.9 1005.2,166.3 1019.1,147.7 1050.9,213.8 1071.3,226.1 1095,242.9 1085.2,212.9 1041.3,124 1041.3,121.3 1049.1,110.8 1083.6,56.1 1047.3,56.1 1006.1,124 1005.2,123.1 1005.2,56.1Z M1101.0,56.1 1123.9,56.1 1123.9,60.7 1114.8,60.7 1114.8,88.2 1110.2,88.2 1110.2,60.7 1101.0,60.7Z M1128.5,88.2 1128.5,56.1 1133.1,56.1 1142.3,69.8 1151.4,56.1 1156.0,56.1 1156.0,88.2 1151.4,88.2 1151.4,65.3 1142.3,79.0 1133.1,65.3 1133.1,88.2Z" fill={theme.foreground} fillRule="evenodd" />
    </Svg>
  </View>;
}

/** Sub-brand typography: HoopFeed uses the existing traced owner lettering;
 * other labels use the existing bundled display font. No network assets. */
export function CommunityWordmark({ reels = false, size = 24 }: { reels?: boolean; size?: number }) {
  const theme = useEntryTheme();
  if (reels) return <Text accessibilityRole="header" accessibilityLabel="HoopReels" style={{ fontFamily: "HoopCheckDisplay", fontSize: size, color: theme.foreground, flexShrink: 1 }}>HOOPREELS™</Text>;
  return <Svg accessible accessibilityRole="image" accessibilityLabel="HoopFeed" width={size * 4.4} height={size} viewBox="126 24 421 82">
    <Path d="M126,26 126,103.1 139.6,90.6 139.6,63.6 139.8,63.2 155.9,63.2 156.6,64 156.3,66.6 156.6,66.9 156.6,91 169.8,103.1 169.8,26 156.6,26 156.3,26.7 156.6,51.5 155.9,52.3 139.8,52.3 139.6,51.9 139.6,39.2 139.2,38.8 139.6,38.4 139.6,26.4 139.2,26Z M205.1,36.9 207.2,39 207.2,78 205.1,80.1 193.5,80.1 191,78 191,39 192.8,37.2Z M186.3,26 178,33.6 177.6,34.6 177.6,82.7 185.9,91 211.9,91 220.2,83.4 220.2,33.6 211.9,26Z M255.5,36.9 257.7,39 257.7,78 255.5,80.1 243.9,80.1 241.4,78 241.4,39 243.2,37.2Z M236.7,26 228.4,33.6 228.1,34.6 228.1,82.7 236.3,91 262.3,91 270.7,83.4 270.7,33.6 262.3,26Z M292.2,37.2 305.6,37.2 307.3,39 307.3,53.8 304.8,56.4 292.6,56.4 291.8,55.6 291.8,37.5Z M312.1,26 278.8,26 278.5,27.8 278.8,28.1 278.5,29.2 278.8,31.4 278.5,103.3 291.8,91 291.8,67.5 292.2,67.1 311.7,67.1 320.3,59.2 320.3,33.6Z M363.9,26 328.5,26 328.1,26.4 328.1,102.2 340.8,91 340.8,63.4 341.1,63.1 359.8,63.1 359.8,52.6 341.1,52.6 340.8,52.2 340.8,37.2 341.1,36.9 364.2,36.9 364.2,26.4Z M408.4,26 372.6,26 372,26.4 372,102.2 384.6,91 408.8,91 408.8,80.4 384.9,80.4 384.6,80.1 384.6,63.4 384.9,63.1 403.3,63.1 403.6,62.8 403.6,52.6 384.9,52.6 384.6,52.2 384.6,38.6 384.2,38.3 384.9,36.9 408.4,36.9Z M452.9,26 417.2,26 416.5,26.4 416.5,102.2 429.2,91 453.3,91 453.3,80.4 429.5,80.4 429.2,80.1 429.2,63.4 429.5,63.1 447.8,63.1 448.2,62.8 448.2,52.6 429.5,52.6 429.2,52.2 429.2,38.6 428.8,38.3 429.5,36.9 452.9,36.9Z M474,36.9 486,36.9 489.1,39.6 489.1,78.1 486.3,80.4 474,80.4 473.7,80.1 473.7,37.2Z M492.1,26 461.5,26 461.1,26.4 461.1,102.2 473.4,91 492.4,91 501.2,82.8 501.2,34.2Z M529.4,26.0 535.9,26.0 535.9,27.3 533.3,27.3 533.3,35.1 532.0,35.1 532.0,27.3 529.4,27.3Z M537.2,35.1 537.2,26.0 538.5,26.0 541.1,29.9 543.7,26.0 545.0,26.0 545.0,35.1 543.7,35.1 543.7,28.6 541.1,32.5 538.5,28.6 538.5,35.1Z" fill={theme.foreground} fillRule="evenodd" />
  </Svg>;
}
