import { Chip, SectionHeader } from "../src/primitives";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";

const directories = [
  { href: "/teams", icon: "basketball-outline", title: "Teams", detail: "Research professional clubs" },
  { href: "/leagues", icon: "earth-outline", title: "Leagues", detail: "Explore competitions" },
  { href: "/players", icon: "people-outline", title: "Players", detail: "Find public player profiles" },
  { href: "/coaches", icon: "school-outline", title: "Coaches", detail: "Find professional coaches" },
] as const;

const accountLinks = [
  { path: "/account", label: "Account settings" },
  { path: "/support", label: "Support" },
  { path: "/terms", label: "Terms of Service" },
  { path: "/privacy", label: "Privacy Policy" },
  { path: "/community-guidelines", label: "Community Guidelines" },
  { path: "/privacy-center", label: "Privacy Request Center" },
];

export default function DashboardScreen() {
  const router = useRouter();
  const theme = useEntryTheme();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState("");

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!alive || error) return;
      setEmail(data.user?.email ?? "");
      const role = data.user?.user_metadata?.account_type;
      if (typeof role === "string") setAccountType(role.replaceAll("_", " "));
    });
    return () => { alive = false; };
  }, []);

  async function openAccountLink(path: string) {
    try {
      await Linking.openURL(`https://hoopcheck.online${path}`);
    } catch {
      Alert.alert("Unable to open link", "Please try again or visit hoopcheck.online in your browser.");
    }
  }

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) {
      Alert.alert("Could not sign out", error.message);
      return;
    }
    router.replace("/");
  }

  const panel = { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: theme.cardRadius };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <SectionHeader>Explore basketball</SectionHeader>
          <View style={styles.directories}>
            {directories.map(({ href, icon, title, detail }) => (
              <Pressable key={href} onPress={() => router.push(href)} accessibilityRole="link" style={({ pressed }) => [
                  styles.directory, panel, pressed && { backgroundColor: theme.accentSurface },
                ]}>
                  <View style={[styles.icon, { backgroundColor: theme.accentSurface }]}>
                    <Ionicons name={icon} size={22} color={theme.accent} />
                  </View>
                  <View style={styles.directoryCopy}>
                    <Text style={[styles.rowLabel, { color: theme.foreground }]}>{title}</Text>
                    <Text style={[styles.detail, { color: theme.muted }]}>{detail}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.accent} />
                </Pressable>
            ))}
          </View>

          <View style={styles.sectionTitle}><SectionHeader>Account &amp; support</SectionHeader></View>
          <View style={[styles.account, panel]}>
            {email ? (
              <View style={styles.identity}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>{email}</Text>
                {accountType ? <View style={{ alignSelf: "flex-start" }}><Chip>{accountType}</Chip></View> : null}
              </View>
            ) : null}
            {accountLinks.map(({ path, label }, index) => (
              <Pressable key={path} accessibilityRole="link" onPress={() => void openAccountLink(path)}
                style={({ pressed }) => [
                  styles.accountLink,
                  (index > 0 || Boolean(email)) && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                  pressed && { backgroundColor: theme.accentSurface },
                ]}>
                <Text style={[styles.linkLabel, { color: theme.foreground }]}>{label}</Text>
                <Ionicons name="open-outline" size={17} color={theme.accent} />
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} onPress={signOut} disabled={busy}
            style={({ pressed }) => [styles.signOut, (pressed || busy) && { opacity: 0.65 }]}>
            <Text style={[styles.rowLabel, { color: theme.accent }]}>{busy ? "Signing out…" : "Sign out"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: 20 },
  content: { width: "100%", maxWidth: 640, alignSelf: "center" },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: -0.7, marginBottom: 16 },
  directories: { gap: 8, marginTop: 12 },
  directory: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  directoryCopy: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: "800" },
  detail: { fontSize: 14, lineHeight: 19, marginTop: 2 },
  sectionTitle: { fontSize: 21, fontWeight: "800", marginTop: 28, marginBottom: 10 },
  account: { borderWidth: 1, overflow: "hidden" },
  identity: { padding: 14, gap: 4 },
  role: { fontSize: 14, textTransform: "capitalize" },
  accountLink: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  linkLabel: { flex: 1, fontSize: 15, fontWeight: "600" },
  signOut: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 12 },
});
