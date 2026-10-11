import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

  async function openHelp(path: string) {
    try { await Linking.openURL(`https://hoopcheck-hoopcheck.vercel.app/${path}`); }
    catch { Alert.alert("Unable to open link", "Please try again or visit hoopcheck-hoopcheck.vercel.app in your browser."); }
  }

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) { Alert.alert("Could not sign out", error.message); return; }
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
        <Pressable onPress={() => router.push("/coaches")} style={styles.playerWideCard}>
          <Text style={styles.directoryIcon}>🧑‍🏫</Text>
          <View style={styles.playerWideBody}>
            <Text style={styles.directoryTitle}>Find coaches</Text>
            <Text style={styles.directoryCaption}>Search the existing coach directory</Text>
          </View>
          <Text style={styles.directoryAction}>Search →</Text>
        </Pressable>
        <Text style={styles.note}>Directories use HoopCheck’s existing Supabase data. Player search only displays public, non-suspended men’s professional profiles. The coach table currently has no active records, so the coach directory will show an honest empty state until data is added. Reviews, membership and account controls are not yet enabled in this mobile milestone.</Text>
        <Text style={styles.sectionTitle}>Help & privacy</Text>
        <View style={styles.legalCard}>
          <Pressable onPress={() => void openHelp("support")} style={styles.legalLink}><Text style={styles.legalText}>Support</Text><Text style={styles.chevron}>›</Text></Pressable>
          <Pressable onPress={() => void openHelp("terms")} style={styles.legalLink}><Text style={styles.legalText}>Terms of Service</Text><Text style={styles.chevron}>›</Text></Pressable>
          <Pressable onPress={() => void openHelp("privacy")} style={styles.legalLink}><Text style={styles.legalText}>Privacy Policy</Text><Text style={styles.chevron}>›</Text></Pressable>
          <Pressable onPress={() => void openHelp("community-guidelines")} style={styles.legalLink}><Text style={styles.legalText}>Community Guidelines</Text><Text style={styles.chevron}>›</Text></Pressable>
          <Pressable onPress={() => void openHelp("privacy-center")} style={styles.legalLink}><Text style={styles.legalText}>Privacy Request Center</Text><Text style={styles.chevron}>›</Text></Pressable>
          <Pressable onPress={() => void openHelp("account")} style={styles.legalLink}><Text style={styles.legalText}>Account settings</Text><Text style={styles.chevron}>›</Text></Pressable>
        </View>
        <Pressable onPress={signOut} disabled={busy} style={[styles.button, busy && styles.dim]}><Text style={styles.buttonText}>{busy ? "Signing out…" : "Sign out"}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FA" },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  wordmark: { color: "#101827", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  title: { color: "#101827", fontSize: 30, fontWeight: "800", marginTop: 18 },
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
  legalCard: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E0E6EE", paddingHorizontal: 14, marginBottom: 6 },
  legalLink: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#EEF1F5" },
  legalText: { color: "#344054", fontSize: 14, fontWeight: "700" },
  chevron: { color: "#946600", fontSize: 23, fontWeight: "700" },
  button: { minHeight: 52, borderRadius: 10, backgroundColor: "#101827", alignItems: "center", justifyContent: "center", marginTop: 18 },
  dim: { opacity: 0.65 }, buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
