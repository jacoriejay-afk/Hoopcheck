import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useEntryTheme } from "../src/theme";

// Bundled decorative court artwork; never a claimed live photo.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const arena = require("../assets/courtside-arena.webp");

/** Small sport masthead. Deliberately omits promotional captions and footer slogans. */
export function CourtsideBanner({ eyebrow, title }: { eyebrow: string; title: string; children: string }) {
  const t = useEntryTheme();
  const shades: [string, string, string] = eyebrow === "HOOPFEED"
    ? ["#19182F", "#29243A", "#332229"] : eyebrow === "HOOPGROUPS"
    ? ["#10272D", "#15363A", "#1C3839"] : eyebrow === "GAME CENTER"
    ? ["#11223C", "#263048", "#332938"] : ["#152339", "#1D2D43", "#33272F"];
  return <View style={{
    borderRadius: t.courtside.hero.radius, borderCurve: "continuous",
    overflow: "hidden", minHeight: t.courtside.hero.minHeight,
    borderWidth: 1, borderColor: t.dark ? "rgba(255,255,255,.18)" : "rgba(25,42,64,.12)",
    backgroundColor: t.courtside.court.background,
  }}>
    <LinearGradient colors={shades} locations={[0, .55, 1]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Image accessible={false} alt="" source={arena} resizeMode="cover"
      style={[StyleSheet.absoluteFill, { opacity: .12 }]} />
    <View style={{ minHeight: t.courtside.hero.minHeight, flexDirection: "row",
      alignItems: "center", gap: 11, paddingHorizontal: 14, paddingVertical: 12 }}>
      <View pointerEvents="none" style={{ backgroundColor: "#FF9855", width: 3,
        height: 42, borderRadius: 3 }} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text numberOfLines={1} style={{ fontFamily: "HoopCheckDisplay", fontSize: 11,
          letterSpacing: .8, color: "#FFAC72" }}>{eyebrow}</Text>
        <Text accessibilityRole="header" numberOfLines={2} style={{ fontFamily: t.type.ui.fontFamily,
          fontWeight: "700", fontSize: 21, lineHeight: 26, color: "#FFFFFF" }}>{title}</Text>
      </View>
      <View pointerEvents="none" accessible={false} style={{ alignItems: "center", gap: 3 }}>
        <Ionicons name="basketball-outline" size={20} color="#FADAC9" />
        <Text style={{ fontFamily: "HoopCheckDisplay", color: "#FADAC9",
          fontSize: 8, letterSpacing: .6 }}>HOOPCHECK</Text>
      </View>
    </View>
  </View>;
}
