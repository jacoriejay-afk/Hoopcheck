import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";
import { getHoopCheckEntitlements } from "../../../lib/membership-tier";

export default function FeedScreen() {
  const theme = useEntryTheme();
  const [access, setAccess] = useState<"loading" | "allowed" | "locked">("loading");
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (alive) setAccess("locked"); return; }
      const [profile, subscription, adminRole] = await Promise.all([
        supabase.from("profiles").select("account_type").eq("id", auth.user.id).maybeSingle(),
        supabase.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", auth.user.id).maybeSingle(),
        supabase.rpc("get_current_user_admin_role"),
      ]);
      if (!alive) return;
      if (profile.error || subscription.error || !profile.data) { setAccess("locked"); return; }
      const permissions = getHoopCheckEntitlements({
        accountType: profile.data.account_type,
        isAdmin: adminRole.data === "admin",
        subscription: subscription.data,
      });
      setAccess(permissions.canReadHoopFeed ? "allowed" : "locked");
    })().catch(() => { if (alive) setAccess("locked"); });
    return () => { alive = false; };
  }, []);
  async function openPage(path: string) {
    try { await Linking.openURL("https://hoopcheck.online" + path); }
    catch { Alert.alert("Unable to open page", "Please try again from hoopcheck.online."); }
  }
  return <SafeAreaView edges={["left", "right"]} style={[styles.safe, { backgroundColor: theme.background }]}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.foreground }]}>HoopFeed™</Text>
      <Text style={[styles.description, { color: theme.muted }]}>The HoopCheck basketball community.</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name={access === "allowed" ? "chatbubbles-outline" : "lock-closed-outline"} size={32} color={theme.accent} />
        <Text style={[styles.title, { color: theme.foreground }]}>{access === "loading" ? "Checking membership…" : access === "allowed" ? "Your community" : "Membership required"}</Text>
        <Text style={[styles.description, { color: theme.muted }]}>{access === "allowed" ? "Open HoopFeed on the website to view and join discussions. Native posts and replies are coming later." : access === "locked" ? "HoopFeed access follows your HoopCheck account and subscription permissions." : "Please wait while we check your access."}</Text>
        {access !== "loading" ? <Pressable accessibilityRole="link" onPress={() => void openPage(access === "allowed" ? "/feed" : "/membership")} style={[styles.button, { backgroundColor: theme.button }]}>
          <Text style={{ color: theme.onButton, fontWeight: "800" }}>{access === "allowed" ? "Open HoopFeed ↗" : "View membership ↗"}</Text>
        </Pressable> : null}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 20, paddingBottom: 32 },
  heading: { fontFamily: "HoopCheckDisplay", fontSize: 32 },
  description: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 12, marginTop: 22 },
  title: { fontSize: 20, fontWeight: "800" },
  button: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 10 },
});