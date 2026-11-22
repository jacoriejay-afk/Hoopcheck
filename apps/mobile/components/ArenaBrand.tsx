import { View, Text } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useEntryTheme } from "../src/theme";

/** Scalable vector interpretation of the owner's white hex-ball and orange strike.
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
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none" accessible={false}>
      <Path d="M100 15 168 54v80l-68 49-68-44V54Z"
        stroke={ink} strokeWidth={10} strokeLinejoin="miter"/>
      <Circle cx="99" cy="99" r="61" stroke={ink} strokeWidth={7}/>
      <Path d="M40 92c32-21 78-17 116 5M61 48c9 34 42 38 80 22M101 39c-22 35-28 91-7 120M137 51c-6 37-5 66 19 88M47 125c23-32 62-35 104-7"
        stroke={ink} strokeWidth={6} strokeLinecap="round"/>
      <Path d="M98 181 145 109 190 70l-32 69-60 42 29-55-29 55Z"
        fill="#FF6A25" stroke="#FF7A31" strokeWidth={2} strokeLinejoin="miter"/>
    </Svg>
    {!markOnly ? <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{
      color: ink, fontFamily: "HoopCheckDisplay", fontSize: compact ? 29 : 38,
      lineHeight: compact ? 33 : 43, letterSpacing: -.6,
      textShadowColor: dark ? "rgba(0,0,0,.35)" : "transparent",
      textShadowRadius: dark ? 8 : 0,
    }}>HOOPCHECK™</Text> : null}
  </View>;
}
