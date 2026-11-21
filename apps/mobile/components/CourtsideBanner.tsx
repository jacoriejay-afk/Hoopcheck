import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useEntryTheme } from "../src/theme";

// Bundled decorative court artwork, never a claimed live photo or player image.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const arena = require("../assets/courtside-arena.webp");

/**
 * Liquid Courtside hero: high-contrast editorial typography with restrained
 * glass and orange light. Data, membership and navigation are owned by screens.
 */
export function CourtsideBanner({ eyebrow, title, children }: { eyebrow: string; title: string; children: string }) {
  const t = useEntryTheme();
  const c = t.courtside.court;
  return <View style={{
    borderRadius: 30, borderCurve: "continuous", overflow: "hidden",
    minHeight: t.courtside.hero.minHeight, borderWidth: 1,
    borderColor: t.dark ? "rgba(255,255,255,.26)" : "rgba(25,42,64,.14)",
    backgroundColor: c.background,
    shadowColor: t.dark ? "#FF7332" : "#172C49", shadowOpacity: t.dark ? .22 : .14,
    shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
  }}>
    <LinearGradient colors={["#101E35", "#182A3E", "#352123"]}
      locations={[0, .55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill} />
    <Image pointerEvents="none" accessible={false} source={arena}
      resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: .24 }]} />
    <LinearGradient pointerEvents="none"
      colors={["rgba(255,139,66,.23)", "rgba(255,124,53,.03)", "rgba(8,18,30,.40)"]}
      start={{ x: .05, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", width: 228, height: 228, borderWidth: 1, borderColor: "rgba(255,255,255,.15)",
        borderRadius: 114, right: -110, top: -48 }} />
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", width: 160, height: 160, borderWidth: 1, borderColor: "rgba(255,255,255,.18)",
        borderRadius: 80, right: -74, top: 0 }} />
    <View style={{ padding: 22, gap: 15 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <View style={{ height: 3, width: 18, borderRadius: 4, backgroundColor: c.orange }} />
          <Text style={{ color: c.orange, fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>{eyebrow}</Text>
        </View>
        <View style={{ borderColor: "rgba(255,255,255,.24)", borderWidth: 1,
          borderRadius: 100, backgroundColor: "rgba(255,255,255,.12)",
          paddingHorizontal: 10, paddingVertical: 7,
          flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name="basketball-outline" size={13} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 9, letterSpacing: 1.4, fontWeight: "800" }}>HOOPCHECK</Text>
        </View>
      </View>
      <View style={{ gap: 8, paddingRight: 22 }}>
        <Text accessibilityRole="header" style={{ fontFamily: "HoopCheckDisplay",
          textTransform: "uppercase", fontSize: 39, lineHeight: 42,
          color: "#FFFFFF", letterSpacing: -.6 }}>{title}</Text>
        <Text style={{ color: "#E3EBF4", fontSize: 14, lineHeight: 21, maxWidth: 290 }}>{children}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 3 }}>
        <View style={{ height: 1, flex: 1, backgroundColor: "rgba(255,255,255,.3)" }} />
        <Text style={{ color: "#F4DFCD", fontSize: 10, fontWeight: "700", letterSpacing: 1.7 }}>THE GAME IS YOURS</Text>
      </View>
    </View>
  </View>;
}
