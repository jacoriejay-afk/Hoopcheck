import { Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useEntryTheme } from "../src/theme";

/** Decorative court markings never capture touches or enter the accessibility tree. */
export function CourtsideBanner({ eyebrow, title, children }: { eyebrow: string; title: string; children: string }) {
  const t = useEntryTheme();
  const court = t.courtside.court;
  return <LinearGradient colors={[court.background, court.end]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: t.courtside.hero.radius, borderCurve: "continuous", overflow: "hidden", padding: t.spacing.xl, gap: t.spacing.md }}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}><Image source={require("../assets/courtside-arena.webp")} accessible={false} resizeMode="cover" style={{ width: "100%", height: "100%", opacity: 0.16 }} /></View>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", right: -76, top: -30, width: 230, height: 230, borderRadius: 115, borderWidth: 1, borderColor: court.line }} />
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", right: -30, top: 16, width: 138, height: 138, borderRadius: 69, borderWidth: 1, borderColor: court.line }} />
    <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}><View style={{ height: 3, width: 24, backgroundColor: court.orange }} /><Text style={{ color: court.orange, fontSize: t.courtside.typography.eyebrow, fontWeight: "800", letterSpacing: 2 }}>{eyebrow}</Text></View>
    <Text accessibilityRole="header" style={{ fontFamily: "HoopCheckDisplay", fontSize: t.courtside.typography.hero, lineHeight: 42, color: court.ink }}>{title}</Text>
    <Text style={{ ...t.type.body, color: court.muted }}>{children}</Text>
  </LinearGradient>;
}
