import { HomeCourtside } from "../components/HomeCourtside";
import { ScreenIntro } from "../components/ScreenIntro";
import { ExploreLinks } from "../components/ExploreLinks";
import { Input, Button, Chip, SectionHeader } from "../src/primitives";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";

const accountLinks = [
  { path: "/about", label: "About HoopCheck" },
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
  const [search, setSearch] = useState("");
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
    if (path === "/account" || path === "/about") { router.push(path); return; }
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
      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" testID="dashboard-scroll" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <ScreenIntro eyebrow="YOUR COURTSIDE CONNECTION" title="Your courtside.">The people, games, and communities that move basketball.</ScreenIntro>
          <View style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.xl, padding: theme.spacing.lg, backgroundColor: theme.surface, borderRadius: theme.radius.hero, borderCurve: "continuous", gap: theme.spacing.sm }}>
          <Input accessibilityLabel="Search basketball directory" placeholder="Search teams, leagues, coaches or players" value={search} maxLength={100} onChangeText={setSearch} returnKeyType="search" onSubmitEditing={() => router.push({ pathname: "/search", params: { q: search } })} />
          <Button style={{ marginTop: 8 }} onPress={() => router.push({ pathname: "/search", params: { q: search } })}>Search</Button>
          </View>
          <HomeCourtside />
          <SectionHeader>Explore basketball</SectionHeader>
          <View style={styles.directories}><ExploreLinks /></View>

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
  scroll: { flexGrow: 1, padding: 16 },
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
