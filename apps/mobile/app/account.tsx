import { MembershipPreview } from "../components/MembershipPreview";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, GlassCard } from "../src/primitives";
import { Skeleton } from "../components/Motion";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { supabase } from "../src/lib/supabase";
export default function AccountScreen() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { account, loading, error, retry } = useNativeAccount();
  useFocusEffect(useCallback(() => { retry(); }, [retry]));
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true); setSignOutError("");
    try {
      const result = await supabase.auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      router.replace("/sign-in");
    } catch { setSignOutError("Couldn’t sign out. Please try again."); }
    finally { setSigningOut(false); }
  }
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 30, fontWeight: "900" }}>Your account</Text>
      {loading ? <Skeleton profile /> : account ? <>
        <GlassCard><Text style={{ color: theme.foreground, fontSize: 23, fontWeight: "800" }}>{account.user.displayName || "HoopCheck member"}</Text><Text style={{ color: theme.muted }}>{account.user.accountType.replaceAll("_", " ")}</Text></GlassCard>
        <GlassCard><Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 19, fontWeight: "700" }}>Membership status</Text><Text style={{ color: theme.accent, fontSize: 22, fontWeight: "800", marginTop: 8 }}>{account.tier === "free" ? "Free" : account.tier === "pro" ? "Pro" : "Premium"}</Text><Text style={{ color: theme.muted }}>{account.hasPaidMembership ? "Active access verified by HoopCheck" : "No active paid membership"}</Text></GlassCard>
      <MembershipPreview />
        <Button secondary onPress={() => router.push("/membership")}>Membership and restore purchases</Button>
        <Button secondary onPress={retry}>Refresh account</Button>
        <Button secondary onPress={() => router.push("/account/edit")}>Edit profile</Button>
        <Button secondary onPress={() => router.push("/messages")}>HoopChat · messages and requests</Button>
        <Button secondary onPress={() => router.push("/notifications")}>Basketball alerts</Button>
        {account.user.accountType === "player" ? <Button secondary onPress={() => router.push({ pathname: "/players/[id]", params: { id: account.user.id } })}>View public player profile</Button> : null}
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/web", params: { path: "/account" } })} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: theme.accent }}>Edit profile and manage account on HoopCheck</Text></Pressable>
      </> : <View style={{ gap: 12 }}><Text accessibilityRole="alert" style={{ color: theme.foreground }}>{error}</Text><Button secondary onPress={retry}>Try again</Button></View>}
      <Button secondary onPress={() => router.push("/account/security")}>Two-factor authentication</Button>
      <Button secondary onPress={() => router.push("/settings")}>Device settings</Button>
      <Button secondary onPress={() => router.push("/connections")}>Connections</Button>
      <Button secondary onPress={() => router.push("/about")}>About HoopCheck</Button>
      <Text style={{ color: theme.muted }}>Role workspaces remain on the authenticated website. Access requires an authorized website role.</Text>
      <Button secondary onPress={() => router.push({ pathname: "/web", params: { path: "/owner-hq" } })}>Owner HQ on website</Button>
      <Button secondary onPress={() => router.push({ pathname: "/web", params: { path: "/ambassador-hq" } })}>Ambassador HQ on website</Button>
      <Button secondary disabled={signingOut} onPress={() => void signOut()}>{signingOut ? "Signing out…" : "Sign out of this device"}</Button>
      {signOutError ? <Text accessibilityRole="alert" style={{ color: theme.foreground }}>{signOutError}</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}
