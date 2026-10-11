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
        <Text style={styles.note}>This is an authentication milestone screen, not the full HoopCheck dashboard. Player search, reviews, support and membership features will be connected only after their backend permissions are reviewed.</Text>
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
  note: { color: "#657287", fontSize: 13, lineHeight: 20, marginTop: 20 },
  button: { minHeight: 52, borderRadius: 10, backgroundColor: "#101827", alignItems: "center", justifyContent: "center", marginTop: 28 },
  dim: { opacity: 0.65 }, buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
