import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEntryTheme } from "../src/theme";

// Metro uses a static asset reference for native image bundling.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const hoopcheckMark = require("../assets/hoopcheck-mark.png");

export default function WelcomeScreen() {
  const theme = useEntryTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.brand}>
            <Image alt="" source={hoopcheckMark} style={styles.mark} />
            <Text style={[styles.wordmark, { color: theme.foreground }]}>HoopCheck™</Text>
          </View>
          <Text accessibilityRole="header" style={[styles.headline, { color: theme.foreground }]}>
            Know who you’re signing with.
          </Text>
          <Text style={[styles.description, { color: theme.muted }]}>
            Research basketball teams, coaches, and leagues through the experiences of players who have been there.
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={() => router.push("/sign-in")} style={({ pressed }) => [
            styles.action,
            styles.primaryAction,
            { borderRadius: theme.cardRadius, opacity: pressed ? 0.75 : 1 },
          ]}>
            <Text style={[styles.actionLabel, styles.primaryActionLabel]}>Sign in</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Create an account" onPress={() => router.push("/sign-up")} style={({ pressed }) => [
            styles.action,
            { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: theme.cardRadius, opacity: pressed ? 0.75 : 1 },
          ]}>
            <Text style={[styles.actionLabel, { color: theme.foreground }]}>Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  content: { width: "100%", maxWidth: 520, alignSelf: "center", gap: 12 },
  brand: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 20 },
  mark: { width: 48, height: 48, borderRadius: 12 },
  wordmark: { flexShrink: 1, fontSize: 23, fontWeight: "800" },
  headline: { fontSize: 44, fontWeight: "900", letterSpacing: -1.4 },
  description: { fontSize: 17, lineHeight: 25, marginBottom: 16 },
  action: { minHeight: 52, padding: 14, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  primaryAction: { backgroundColor: "#FF793D" },
  primaryActionLabel: { color: "#1A100A" },
});
