import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { cubicBezier } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { preSignChecks } from "../../../lib/pre-sign/checks";
import { Button, GlassCard } from "../src/primitives";
import { motion } from "../src/motion/config";
import { useMotionSetting } from "../src/motion/Provider";
import { useEntryTheme } from "../src/theme";

const progressEasing = cubicBezier(0.23, 1, 0.32, 1);

type CheckId = (typeof preSignChecks)[number]["id"];

export default function PreSignScreen() {
  const theme = useEntryTheme();
  const reduced = useMotionSetting();
  const [reviewed, setReviewed] = useState<CheckId[]>([]);
  const progress = reviewed.length / preSignChecks.length;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
    >
      <Text style={{ color: theme.muted, ...theme.type.body }}>Research the club and the offer before you commit.</Text>
      <Text accessibilityLiveRegion="polite" style={{ color: theme.accent, fontWeight: "700" }}>
        {reviewed.length} of {preSignChecks.length} reviewed
      </Text>
      <View aria-hidden testID="pre-sign-progress" style={{
        height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: "hidden",
      }}>
        <Animated.View testID="pre-sign-progress-fill" style={{
          flex: 1,
          backgroundColor: theme.accent,
          borderRadius: 3,
          transformOrigin: "left center",
          transform: [{ scaleX: progress }],
          transitionProperty: reduced ? "none" : "transform",
          transitionDuration: reduced ? 0 : motion.progress,
          transitionTimingFunction: progressEasing,
        }} />
      </View>
      {preSignChecks.map(check => {
        const checked = reviewed.includes(check.id);
        return (
          <GlassCard key={check.id} style={{ gap: theme.spacing.sm }}>
            <Text accessibilityRole="header" style={{ color: theme.foreground, ...theme.type.section }}>{check.title}</Text>
            <Text style={{ color: theme.muted, ...theme.type.body }}>{check.detail}</Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={check.title + " reviewed"}
              aria-checked={checked}
              onPress={() => setReviewed(current => current.includes(check.id) ? current.filter(id => id !== check.id) : [...current, check.id])}
              style={({ pressed }) => ({
                minHeight: 48, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name={checked ? "checkbox" : "square-outline"} size={24} color={theme.accent} />
              <Text style={{ color: theme.foreground }}>{checked ? "Reviewed" : "Mark reviewed"}</Text>
            </Pressable>
          </GlassCard>
        );
      })}
      <Text style={{ color: theme.muted, ...theme.type.body }}>This checklist is personal research. Selections are kept while this screen is open.</Text>
      <Button secondary disabled={reviewed.length === 0} onPress={() => setReviewed([])}>Reset checklist</Button>
    </ScrollView>
  );
}
