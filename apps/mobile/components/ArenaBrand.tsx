import { View, Text } from "react-native";
import { BrandMark } from "./BrandLockup";
import { useEntryTheme } from "../src/theme";

/** Use the approved November 24 vector mark within the existing arena layout.
 * The logo does not use the illustration's smoke layer as real app UI.
 * Keep the brand artwork decorative; the accessible label names the whole mark.
 */
export function ArenaBrand({ size = 116, compact = false, dark = true, markOnly = false }: {
  size?: number; compact?: boolean; dark?: boolean; markOnly?: boolean;
}) {
  const theme = useEntryTheme();
  const ink = dark ? "#FFFFFF" : theme.foreground;
  return <View accessible accessibilityRole="image" accessibilityLabel="HoopCheck™"
    style={{ alignItems: "center", alignSelf: "center", gap: compact ? 5 : 9 }}>
    <BrandMark size={size} ink={ink} />
    {!markOnly ? <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{
      color: ink, fontFamily: "HoopCheckDisplay", fontSize: compact ? 29 : 38,
      lineHeight: compact ? 33 : 43, letterSpacing: -.6,
      textShadowColor: dark ? "rgba(0,0,0,.35)" : "transparent",
      textShadowRadius: dark ? 8 : 0,
    }}>HOOPCHECK™</Text> : null}
  </View>;
}
