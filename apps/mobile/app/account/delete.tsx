import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Input } from "../../src/primitives";
import { useEntryTheme } from "../../src/theme";
import { supabase } from "../../src/lib/supabase";
import { useNativeAccount } from "../../src/native/useNativeAccount";

export default function DeleteAccount() {
  const { account, loading } = useNativeAccount();
  const theme = useEntryTheme();
  if (!account) return <View style={{ flex: 1, backgroundColor: theme.background, padding: 24 }}>
    <Text style={{ color: theme.foreground }}>{loading ? "Verifying account…" : "Sign in and verify your account first."}</Text>
  </View>;
  return <DeletionForm key={account.user.id} owner={account.user.id} />;
}

function DeletionForm({ owner }: { owner: string }) {
  const theme = useEntryTheme(), router = useRouter();
  const [mode, setMode] = useState<"as_soon_as_possible" | "after_30_days">("as_soon_as_possible");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const enabled = process.env.EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED === "true";
  async function submit() {
    if (!enabled || submitting.current || confirmation !== "DELETE") return;
    submitting.current = true; setBusy(true); setMessage("");
    try {
      const before = await supabase.auth.getSession();
      const token = before.data.session?.access_token;
      if (before.error || !token || before.data.session?.user.id !== owner) throw Error("Your account changed. Sign in again.");
      const verified = await supabase.auth.getUser(token);
      const current = await supabase.auth.getSession();
      if (verified.error || verified.data.user?.id !== owner || current.error || current.data.session?.user.id !== owner) throw Error("Verify your account again.");
      const url = new URL(process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online");
      if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw Error("Invalid service configuration.");
      url.pathname = "/api/account/deletion-request";
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
      try {
        const result = await fetch(url.href, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE", mode }), signal: controller.signal, redirect: "error" });
        const response = await result.json();
        const after = await supabase.auth.getSession();
        if (after.error || after.data.session?.user.id !== owner) return;
        if (!result.ok || result.status !== 202 || typeof response.requestId !== "string") {
          if (result.status === 403) throw Error("Sign in again with your original login method and verify your authenticator, if enabled. Then return to this page.");
          throw Error("The request was not confirmed. Try again.");
        }
        setConfirmation("");
        setMessage("Deletion request recorded. Your account has not been deleted yet. Reference: " + response.requestId + ". Status: " + response.status + ".");
      } finally { clearTimeout(timer); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to confirm request. Try again."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 14 }}>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontFamily: "HoopCheckDisplay", fontSize: 26 }}>Delete account</Text>
    <Text style={{ color: theme.foreground }}>Account deletion is different from signing out or hiding your profile. Once completed, your account and personal information will be removed except where lawful retention applies.</Text>
    <Text style={{ color: theme.muted }}>Deleting your account does not automatically stop an Apple subscription. Manage your subscriptions separately to prevent future charges.</Text>
    <Button secondary onPress={() => router.push("/membership")}>Manage membership</Button>
    {enabled ? <>
      <Text style={{ color: theme.foreground, fontWeight: "700" }}>When should processing begin?</Text>
      <Button secondary disabled={busy} onPress={() => setMode("as_soon_as_possible")}>{mode === "as_soon_as_possible" ? "✓ " : ""}As soon as possible</Button>
      <Button secondary disabled={busy} onPress={() => setMode("after_30_days")}>{mode === "after_30_days" ? "✓ " : ""}After 30 days</Button>
      <Text style={{ color: theme.muted }}>A request is not a completed deletion. Processing and legally required retention may take time. You may need to sign in again before submitting.</Text>
      <Input accessibilityLabel="Type DELETE to confirm" placeholder="Type DELETE" autoCapitalize="characters" autoCorrect={false} value={confirmation} onChangeText={setConfirmation} editable={!busy} />
      <Button disabled={busy || confirmation !== "DELETE"} onPress={() => void submit()}>{busy ? "Submitting…" : "Request account deletion"}</Button>
    </> : <Text style={{ color: theme.muted }}>Account deletion is currently unavailable. No account or subscription changes have been made.</Text>}
    {message ? <Text accessibilityRole="alert" style={{ color: theme.foreground }}>{message}</Text> : null}
  </ScrollView>;
}
