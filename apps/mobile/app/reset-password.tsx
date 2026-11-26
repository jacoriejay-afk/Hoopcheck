import { GlassCard, Input, Button } from "../src/primitives";
import { ArenaBrand } from "../components/ArenaBrand";
import { useEntryTheme, type EntryTheme } from "../src/theme";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase, supabaseConfigurationError } from "../src/lib/supabase";

export default function ResetPasswordScreen() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[]; token_hash?: string | string[]; type?: string | string[]; error_description?: string | string[]; error?: string | string[]; error_code?: string | string[] }>();
  const code = typeof params.code === "string" ? params.code : "";
  const token = typeof params.token_hash === "string" && params.type === "recovery" ? params.token_hash : "";
  const invalid = Boolean(params.error_description || params.error || params.error_code || (code && token));
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"checking" | "confirm" | "ready" | "failed" | "done">("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const busyRef = useRef(false);
  type Recovery = { owner: string; sessionId: string };
  const verified = useRef<Recovery | null>(null);
  const verification = useRef<{ key: string; work: Promise<Recovery> } | null>(null);
  const invalidMessage = "This recovery link is invalid, expired or already used. Request a fresh recovery email.";
  function identity(session: { access_token: string; user: { id: string } } | null): Recovery {
    const id: unknown = JSON.parse(atob((session?.access_token.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/"))).session_id;
    if (!session || typeof id !== "string" || !id) throw new Error(invalidMessage);
    return { owner: session.user.id, sessionId: id };
  }
  useEffect(() => {
    let alive = true;
    verified.current = null;
    setPassword(""); setConfirmation(""); setMessage("");
    if (invalid || (!code && !token) || supabaseConfigurationError) {
      setPhase("failed"); setMessage(invalidMessage);
      return;
    }
    if (token) { setPhase("confirm"); return; }
    setPhase("checking");
    if (verification.current?.key !== code) {
      verification.current = { key: code, work: (async () => {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || data.redirectType !== "PASSWORD_RECOVERY") throw new Error(invalidMessage);
        return identity(data.session);
      })() };
    }
    void verification.current.work.then(value => {
      if (alive) { verified.current = value; setPhase("ready"); }
    }).catch(() => { if (alive) { setPhase("failed"); setMessage(invalidMessage); } });
    return () => { alive = false; };
  }, [code, token, invalid]);
  async function confirmLink() {
    if (busyRef.current || phase !== "confirm" || !token) return;
    busyRef.current = true; setBusy(true); setPhase("checking");
    try {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: "recovery" });
      if (error) throw error;
      verified.current = identity(data.session);
      setPhase("ready");
    } catch { setPhase("failed"); setMessage(invalidMessage); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function savePassword() {
    if (phase !== "ready" || !verified.current || busyRef.current) return;
    if (password.length < 8) { setMessage("Use at least 8 characters for your new password."); return; }
    if (password !== confirmation) { setMessage("Enter the same password in both fields."); return; }
    busyRef.current = true; setBusy(true); setMessage("");
    try {
      const change = (supabase.auth as unknown as Record<symbol, (owner: string, id: string, password: string) => Promise<{ error: unknown; signOutError?: unknown }>>)[Symbol.for("hoopcheck.recovery-password")];
      const result = await change(verified.current.owner, verified.current.sessionId, password);
      if (result.error) throw result.error;
      verified.current = null; setPassword(""); setConfirmation(""); setPhase("done");
      setMessage(result.signOutError ? "Password changed. Sign out before signing in again." : "Password updated. Sign in with your new password.");
    } catch { verified.current = null; setPhase("failed"); setMessage("Could not complete recovery. Request a new link and try again."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <GlassCard style={styles.container}>
          <ArenaBrand size={62} compact dark={theme.dark}/>
          <Text style={[styles.title, { fontFamily: "HoopCheckDisplay", fontWeight: "400" }]}>Choose a new password</Text>
          <Text style={styles.subtitle}>Use at least 8 characters. This updates the password for your HoopCheck account.</Text>
          {phase === "checking" ? <Text accessibilityRole="progressbar" style={styles.subtitle}>Validating recovery link…</Text> : null}
          {phase === "confirm" ? <Button onPress={() => void confirmLink()} disabled={busy} style={styles.button}><Text style={styles.buttonText}>Continue to reset password</Text></Button> : null}
          {phase === "ready" ? <>
            <Text style={styles.label}>New password</Text>
            <Input accessibilityLabel="New password" placeholderTextColor={theme.muted} value={password} onChangeText={setPassword} secureTextEntry={!visible} autoComplete="new-password" textContentType="newPassword" style={styles.input} placeholder="At least 8 characters" />
            <Text style={styles.subtitle}>{password.length >= 8 ? "Minimum length met" : "At least 8 characters required"}</Text>
            <Text style={styles.label}>Confirm new password</Text>
            <Input accessibilityLabel="Confirm new password" placeholderTextColor={theme.muted} value={confirmation} onChangeText={setConfirmation} secureTextEntry={!visible} autoComplete="new-password" textContentType="newPassword" style={styles.input} placeholder="Enter it again" />
            <Text accessibilityRole="button" onPress={() => setVisible(value => !value)} style={styles.link}>{visible ? "Hide passwords" : "Show passwords"}</Text>
            <Button onPress={() => void savePassword()} disabled={busy} style={[styles.button, busy && styles.dim]}><Text style={styles.buttonText}>{busy ? "Saving…" : "Update password"}</Text></Button>
          </> : null}
          {message ? <Text accessibilityRole="alert" style={styles.subtitle}>{message}</Text> : null}
          {phase === "failed" ? <Link href="/forgot-password" style={styles.link}>Request a new recovery email</Link> : null}
          {phase === "failed" || phase === "done" ? <Text accessibilityRole="button" onPress={() => router.replace("/sign-in")} style={styles.link}>Back to sign in</Text> : null}
        </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: EntryTheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background }, flex: { flex: 1 },
  container: { margin: 24, justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "800", color: theme.foreground },
  subtitle: { color: theme.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  label: { color: theme.foreground, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  input: { minHeight: 50, borderColor: theme.border, borderWidth: 1, borderRadius: theme.radius.control, backgroundColor: theme.input, paddingHorizontal: 14, color: theme.foreground, fontSize: 16 },
  button: { minHeight: 52, borderRadius: theme.radius.control, backgroundColor: theme.button, alignItems: "center", justifyContent: "center", marginTop: 24 },
  link: { color: theme.accent, fontWeight: "700", textAlign: "center", marginTop: 18 },
  dim: { opacity: 0.65 }, buttonText: { color: theme.onButton, fontWeight: "800" },
});
