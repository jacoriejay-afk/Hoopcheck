import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";

const links = [
  { label: "Edit profile", path: "/account", icon: "person-circle-outline" },
  { label: "Membership", path: "/membership", icon: "card-outline" },
    { label: "Support", path: "/support", icon: "help-circle-outline" },
] as const;

export default function AccountScreen() {
  const router = useRouter();
  const theme = useEntryTheme();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.user?.email ?? "");
      setName(String(data.user?.user_metadata?.display_name || data.user?.email?.split("@")[0] || "HoopCheck member"));
    });
    return () => { mounted = false; };
  }, []);
  async function openWebsite(path: string) {
    try { await Linking.openURL("https://hoopcheck.online" + path); }
    catch { Alert.alert("Unable to open page", "Visit hoopcheck.online to continue."); }
  }
  async function signOut() {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) { Alert.alert("Could not sign out", error.message); return; }
    router.replace("/");
  }
  return (
    <SafeAreaView edges={["left", "right"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.foreground }]}>Account</Text>
        <View style={[styles.profile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="person-circle-outline" size={52} color={theme.accent} />
          <View style={styles.copy}>
            <Text style={[styles.name, { color: theme.foreground }]}>{name}</Text>
            <Text style={[styles.email, { color: theme.muted }]}>{email}</Text>
          </View>
        </View>
        <Text style={[styles.kicker, { color: theme.muted }]}>YOUR ACCOUNT</Text>
        {links.map(link => (
          <Pressable key={link.path} accessibilityRole="link" onPress={() => void openWebsite(link.path)}
            style={[styles.link, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name={link.icon} size={22} color={theme.accent} />
            <Text style={[styles.linkText, { color: theme.foreground }]}>{link.label}</Text>
            <Ionicons name="open-outline" size={17} color={theme.muted} />
          </Pressable>
        ))}
        <Pressable accessibilityRole="link" onPress={() => router.push("/notifications")}
          style={[styles.link, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="notifications-outline" size={22} color={theme.accent} />
          <Text style={[styles.linkText, { color: theme.foreground }]}>Alerts</Text>
          <Ionicons name="chevron-forward" size={17} color={theme.muted} />
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push("/settings")}
          style={[styles.link, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="settings-outline" size={22} color={theme.accent} />
          <Text style={[styles.linkText, { color: theme.foreground }]}>App settings</Text>
          <Ionicons name="chevron-forward" size={17} color={theme.muted} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void signOut()} style={styles.signOut}>
          <Text style={{ color: theme.accent, fontWeight: "800" }}>{busy ? "Signing out…" : "Sign out"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 20, paddingBottom: 32 },
  heading: { fontFamily: "HoopCheckDisplay", fontSize: 30, marginBottom: 18 },
  profile: { flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderRadius: 16, padding: 16 },
  copy: { flex: 1 }, name: { fontSize: 19, fontWeight: "800" }, email: { fontSize: 13, marginTop: 4 },
  kicker: { fontSize: 11, fontWeight: "900", letterSpacing: 1, marginTop: 28, marginBottom: 12 },
  link: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderRadius: 14, marginBottom: 8 },
  linkText: { flex: 1, fontSize: 15, fontWeight: "700" }, signOut: { minHeight: 54, alignItems: "center", justifyContent: "center", marginTop: 14 },
});