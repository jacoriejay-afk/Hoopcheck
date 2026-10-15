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
        <View style={styles.brandLockup}><View style={styles.brandMark}><Text style={styles.brandMarkText}>HC</Text><View style={styles.brandArrow} /></View><Text style={styles.wordmark}>HOOP<Text style={styles.wordmarkAccent}>CHECK</Text></Text></View>
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
            <Text style={styles.directoryCaption}>Search public professional player profiles</Text>
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
        <Text style={styles.note}>Directories use HoopCheck’s existing Supabase data. Player search only displays public, non-suspended professional profiles from men’s and women’s basketball. The coach table currently has no active records, so the coach directory will show an honest empty state until data is added. Reviews, membership and account controls are not yet enabled in this mobile milestone.</Text>
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
  safe: { flex: 1, backgroundColor: "#050505" },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }, brandMark: { width: 38, height: 38, borderWidth: 1.5, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center", position: "relative" }, brandMarkText: { color: "#FF6A00", fontSize: 14, fontWeight: "900" }, brandArrow: { position: "absolute", width: 13, height: 2, backgroundColor: "#FF6A00", right: -3, top: 8, transform: [{ rotate: "-38deg" }] }, wordmark: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", letterSpacing: -0.8 }, wordmarkAccent: { color: "#FF6A00" },
  title: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", marginTop: 18 },
  subtitle: { color: "#BDBDBD", fontSize: 16, marginTop: 8 },
  card: { backgroundColor: "#111111", borderRadius: 12, padding: 18, borderWidth: 1, borderColor: "#303030", marginTop: 26 },
  cardLabel: { color: "#969696", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  value: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginTop: 8 },
  role: { color: "#BDBDBD", marginTop: 8, textTransform: "capitalize" },
  sectionTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", marginTop: 26, marginBottom: 12 },
  playerWideCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#111111", borderRadius: 12, borderWidth: 1, borderColor: "#303030", padding: 14, marginBottom: 10 },
  playerWideBody: { flex: 1 },
  directoryRow: { flexDirection: "row", gap: 10 },
  directoryCard: { flex: 1, backgroundColor: "#111111", borderRadius: 12, borderWidth: 1, borderColor: "#303030", padding: 14, minHeight: 154 },
  directoryIcon: { fontSize: 22 },
  directoryTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginTop: 8 },
  directoryCaption: { color: "#969696", fontSize: 12, lineHeight: 17, marginTop: 4 },
  directoryAction: { color: "#FF6A00", fontWeight: "800", fontSize: 12, marginTop: 10 },
  note: { color: "#969696", fontSize: 13, lineHeight: 20, marginTop: 18 },
  legalCard: { backgroundColor: "#111111", borderRadius: 12, borderWidth: 1, borderColor: "#303030", paddingHorizontal: 14, marginBottom: 6 },
  legalLink: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#292929" },
  legalText: { color: "#D0D0D0", fontSize: 14, fontWeight: "700" },
  chevron: { color: "#FF6A00", fontSize: 23, fontWeight: "700" },
  button: { minHeight: 52, borderRadius: 10, backgroundColor: "#050505", alignItems: "center", justifyContent: "center", marginTop: 18 },
  dim: { opacity: 0.65 }, buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
