import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { useEntryTheme } from "../src/theme";

/**
 * Translucent iOS-style glass surface with an opaque high-contrast fallback.
 * Uses iOS 26 UIGlassEffect on compatible devices, with Expo Blur and solid
 * alternatives. Never blur a long scrolling list item by default.
 */
export function GlassSurface({
  children, style, intensity = 45, solid = false, native = true, navigation = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  solid?: boolean;
  native?: boolean;
  navigation?: boolean;
}) {
  const theme = useEntryTheme();
  // The safe initial state is opaque until the OS accessibility setting loads.
  const [reduceTransparency, setReduceTransparency] = useState(true);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let mounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => {
      if (mounted) setReduceTransparency(value);
    }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduceTransparency);
    return () => { mounted = false; sub.remove(); };
  }, []);
  const opaque = solid || reduceTransparency || Platform.OS !== "ios";
  // Guard both compiler and runtime API capability: older iOS 26 betas can crash.
  const nativeGlass = native && !opaque && Platform.OS === "ios"
    && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  return <View style={[{
    borderRadius: 24, borderCurve: "continuous", overflow: "hidden",
    backgroundColor: opaque ? theme.surface : navigation && nativeGlass ? "transparent" : theme.glassFill,
    borderWidth: 1, borderColor: theme.glassBorder,
  }, style]}>
    {nativeGlass ? <GlassView pointerEvents="none" accessible={false}
      glassEffectStyle={navigation ? "clear" : "regular"} colorScheme={theme.dark ? "dark" : "light"} tintColor={navigation ? undefined : theme.dark ? "#182B43" : "#EAF1FC"}
      style={[StyleSheet.absoluteFill, { borderRadius: 24 }]} /> :
      !opaque ? <BlurView pointerEvents="none" accessible={false}
        intensity={intensity} tint={theme.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : null}
    {!navigation ? <LinearGradient pointerEvents="none" accessible={false}
      colors={theme.dark ? ["rgba(255,255,255,0.15)", "rgba(255,255,255,0.025)", "rgba(255,255,255,0.005)"] : ["rgba(255,255,255,0.72)", "rgba(255,255,255,0.16)", "rgba(255,255,255,0.04)"]}
      locations={[0, 0.38, 1]} style={StyleSheet.absoluteFill} /> : null}
    {children}
  </View>;
}
