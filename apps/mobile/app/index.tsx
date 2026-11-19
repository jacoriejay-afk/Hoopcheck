import { Button } from "../src/primitives";
import { useRouter } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
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
        <View style={[styles.content, { backgroundColor: theme.entityHero.background, padding: theme.spacing.lg, borderRadius: theme.radius.control, borderCurve: "continuous" }]}>
          <View style={styles.brand}>
            <Image alt="HoopCheck" accessibilityLabel="HoopCheck" source={hoopcheckMark} style={styles.mark} />

          </View>
          <Text style={{ color: theme.button, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>THE GLOBAL BASKETBALL INTELLIGENCE HUB</Text>
          <Text accessibilityRole="header" style={[theme.type.display, styles.headline, { color: theme.entityHero.ink }]}>
            Know who you’re signing with.
          </Text>
          <Text style={[styles.description, { color: theme.entityHero.muted }]}>
            Explore teams, coaches, leagues, and real basketball experiences. Built for players and fans worldwide.
          </Text>
          <Button accessibilityLabel="Create an account" onPress={() => router.push("/sign-up")}>Create an account</Button>
          <Button secondary accessibilityLabel="Sign in" onPress={() => router.push("/sign-in")}>Sign in</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16 },
  content: { width: "100%", maxWidth: 520, alignSelf: "center", gap: 12 },
  brand: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 8 },
  mark: { width: 48, height: 48, },
  headline: { fontSize: 32, lineHeight: 34 },
  description: { fontSize: 15, lineHeight: 21, marginBottom: 16 },
  action: { minHeight: 52, padding: 14, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 16, fontWeight: "800", textAlign: "center" },
});
