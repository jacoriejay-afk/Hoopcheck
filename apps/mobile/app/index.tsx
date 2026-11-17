import { GlassCard, Button } from "../src/primitives";
import { Link } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEntryTheme } from "../src/theme";

// Metro uses a static asset reference for native image bundling.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const hoopcheckMark = require("../assets/hoopcheck-mark.png");

export default function WelcomeScreen() {
  const theme = useEntryTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <GlassCard style={styles.content}>
          <View style={styles.brand}>
            <Image accessibilityLabel="HoopCheck" source={hoopcheckMark} style={styles.mark} />

          </View>
          <Text accessibilityRole="header" style={[theme.type.display, styles.headline, { color: theme.foreground }]}>
            Know who you’re signing with.
          </Text>
          <Text style={[styles.description, { color: theme.muted }]}>
            Research basketball teams, coaches, and leagues through the experiences of players who have been there.
          </Text>
          <Link href="/sign-in" asChild><Button>Sign in</Button></Link>
          <Link href="/sign-up" asChild><Button secondary>Create an account</Button></Link>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  content: { width: "100%", maxWidth: 520, alignSelf: "center", gap: 12 },
  brand: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 20 },
  mark: { width: 48, height: 48, },
  headline: {},
  description: { fontSize: 17, lineHeight: 25, marginBottom: 16 },
  action: { minHeight: 52, padding: 14, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 16, fontWeight: "800", textAlign: "center" },
});
