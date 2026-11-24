import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { GlassSurface } from "../GlassSurface";
import { useEntryTheme } from "../../src/theme";
import { glassTokens as glass } from "../../src/glassTheme";

/** Blur only hero/featured surfaces. Virtualized list rows must pass solid. */
export function GlassCard({ children, style, radius = glass.radii.card, padding = 16, solid = false, testID, contentStyle }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; padding?: number;
  solid?: boolean; testID?: string; contentStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useEntryTheme();
  return <GlassSurface native={false} solid={solid} intensity={52} style={[{
    borderRadius: radius, borderWidth: 1, borderColor: theme.glassBorder,
    // GlassSurface owns the background: reduce-transparency must override translucency.
    padding, overflow: "hidden",
  }, style]}>
    <View pointerEvents="none" accessible={false}
      style={{ position: "absolute", top: 0, left: radius / 2, right: radius / 2,
        height: 1, backgroundColor: theme.glassBorder }} />
    <View testID={testID} style={contentStyle}>{children}</View>
  </GlassSurface>;
}
