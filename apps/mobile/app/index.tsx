import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>HC</Text>
        </View>
        <Text style={styles.wordmark}>HoopCheck</Text>
        <Text style={styles.headline}>Know who you’re signing with.</Text>
        <Text style={styles.description}>
          Research professional basketball teams, coaches and leagues before you make your next move.
        </Text>
        <Link href="/sign-in" style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Link>
        <Text style={styles.footer}>Built for basketball players.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#101827" },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 32 },
  brandMark: {
    width: 60, height: 60, borderRadius: 16, backgroundColor: "#F5B82E",
    alignItems: "center", justifyContent: "center", marginBottom: 18,
  },
  brandMarkText: { color: "#101827", fontSize: 23, fontWeight: "900" },
  wordmark: { color: "#FFFFFF", fontSize: 29, fontWeight: "800", letterSpacing: -0.6 },
  headline: { color: "#FFFFFF", fontSize: 34, fontWeight: "800", lineHeight: 40, marginTop: 42 },
  description: { color: "#C7D0DE", fontSize: 16, lineHeight: 24, marginTop: 14, marginBottom: 30 },
  primaryButton: {
    backgroundColor: "#F5B82E", borderRadius: 12, minHeight: 52,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 15,
  },
  primaryButtonText: { color: "#101827", fontSize: 16, fontWeight: "800" },
  footer: { color: "#98A5B8", fontSize: 12, marginTop: 34, textAlign: "center" },
});
