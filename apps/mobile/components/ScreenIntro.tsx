import { Text, View } from "react-native";
import { useEntryTheme } from "../src/theme";

/** Compact editorial identity; text remains free to wrap at accessibility sizes. */
export function ScreenIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: string }) {
  const t = useEntryTheme();
  return <View style={{ gap: t.spacing.sm, paddingVertical: t.spacing.md }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 20, height: 3, backgroundColor: t.accent, borderRadius: 2 }} />
      <Text style={{ ...t.type.caption, color: t.accent, fontWeight: "800", letterSpacing: 1 }}>{eyebrow}</Text>
    </View>
    <Text accessibilityRole="header" style={{ ...t.type.title, color: t.foreground }}>{title}</Text>
    <Text style={{ ...t.type.body, color: t.muted }}>{children}</Text>
  </View>;
}
