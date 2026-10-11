import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";

export default function DashboardScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState("member");

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!alive || error) return;
      setEmail(data.user?.email ?? "");
      const role = data.user?.user_metadata?.account_type;
      if (typeof role === "string" && role.length > 0) setAccountType(role);
    });
    return () => { alive = false; };
  }, []);

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) { Alert.alert("Could not sign out", error.message); return; }
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.wordmark}>HoopCheck</Text>
        <Text style={styles.title}>You’re signed in.</Text>
        <Text style={styles.subtitle}>Welcome to your mobile account.</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>ACCOUNT</Text>
          <Text style={styles.value}>{email || "Signed-in member"}</Text>
          <Text style={styles.role}>Account type: {accountType}</Text>
        </View>
        <Text style={styles.sectionTitle}>Explore basketball</Text>
        <Pressable onPress={() => router.push("/players")} style={styles.playerWideCard}>
          <Text style={styles.directoryIcon}>👤</Text>
          <View style={styles.playerWideBody}>
            <Text style={styles.directoryTitle}>Find players</Text>
            <Text style={styles.directoryCaption}>Search public men’s professional player profiles</Text>
          </View>
          <Text style={styles.directoryAction}>Search →</Text>
        </Pressable>
        <View style={styles.directoryRow}>
          <Pressable onPress={() => router.push("/teams")} style={styles.directoryCard}>
            <Text style={styles.directoryIcon}>🏀</Text>
            <Text style={styles.directoryTitle}>Teams</Text>
            <Text style={styles.directoryCaption}>Search professional clubs</Text>
            <Text style={styles.directoryAction}>Browse teams →</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/leagues")} style={styles.directoryCard}>
            <Text style={styles.directoryIcon}>🌍</Text>
            <Text style={styles.directoryTitle}>Leagues</Text>
            <Text style={styles.directoryCaption}>Explore competitions</Text>
            <Text style={styles.directoryAction}>Browse leagues →</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>Player, team and league directories use HoopCheck’s existing Supabase data. Player search only displays public, non-suspended men’s professional profiles. Reviews, coach profiles, membership and account controls are not yet enabled in this mobile milestone.</Text>
        <Pressable onPress={signOut} disabled={busy} style={[styles.button, busy && styles.dim]}><Text style={styles.buttonText}>{busy ? "Signing out…" : "Sign out"}</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FA" },
  container: { flex: 1, justifyContent: "center", padding: 24 },
  wordmark: { color: "#101827", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  title: { color: "#101827", fontSize: 30, fontWeight: "800", marginTop: 28 },
  subtitle: { color: "#586579", fontSize: 16, marginTop: 8 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 18, borderWidth: 1, borderColor: "#E0E6EE", marginTop: 26 },
  cardLabel: { color: "#657287", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  value: { color: "#101827", fontSize: 16, fontWeight: "700", marginTop: 8 },
  role: { color: "#586579", marginTop: 8, textTransform: "capitalize" },
  sectionTitle: { color: "#101827", fontSize: 18, fontWeight: "900", marginTop: 26, marginBottom: 12 },
  playerWideCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E0E6EE", padding: 14, marginBottom: 10 },
  playerWideBody: { flex: 1 },
  directoryRow: { flexDirection: "row", gap: 10 },
  directoryCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E0E6EE", padding: 14, minHeight: 154 },
  directoryIcon: { fontSize: 22 },
  directoryTitle: { color: "#101827", fontSize: 16, fontWeight: "900", marginTop: 8 },
  directoryCaption: { color: "#657287", fontSize: 12, lineHeight: 17, marginTop: 4 },
  directoryAction: { color: "#946600", fontWeight: "800", fontSize: 12, marginTop: 10 },
  note: { color: "#657287", fontSize: 13, lineHeight: 20, marginTop: 18 },
  button: { minHeight: 52, borderRadius: 10, backgroundColor: "#101827", alignItems: "center", justifyContent: "center", marginTop: 28 },
  dim: { opacity: 0.65 }, buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
