import { GlassCard, Input, Button } from "../src/primitives";
import { useEntryTheme, type EntryTheme } from "../src/theme";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase, supabaseConfigurationError } from "../src/lib/supabase";

export default function ResetPasswordScreen() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[]; error_description?: string | string[]; error?: string | string[] }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const recoveryError = params.error_description || params.error;
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    async function prepareRecovery() {
      if (supabaseConfigurationError) {
        if (alive) Alert.alert("Setup required", supabaseConfigurationError);
        return;
      }
      if (recoveryError) {
        if (alive) Alert.alert("Recovery link invalid", "This recovery link was denied or expired. Request a new password recovery email.");
        return;
      }
      if (!code) {
        if (alive) Alert.alert("Recovery link missing", "Open the latest password recovery link from your email on this device.");
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        if (alive) Alert.alert("Recovery link expired", "Request a new password recovery email and open its link on this device.");
        return;
      }
      if (alive) setReady(true);
    }
    void prepareRecovery();
    return () => { alive = false; };
  }, [code, recoveryError]);

  async function savePassword() {
    if (!ready) { Alert.alert("Recovery not ready", "Open a valid recovery link from your email first."); return; }
    if (password.length < 8) { Alert.alert("Password too short", "Use at least 8 characters for your new password."); return; }
    if (password !== confirmation) { Alert.alert("Passwords do not match", "Enter the same password in both fields."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert("Password updated", "Your HoopCheck password has been changed.", [
        { text: "Continue", onPress: () => router.replace("/dashboard") },
      ]);
    } catch (error) {
      Alert.alert("Could not update password", error instanceof Error ? error.message : "Please request a new recovery link and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <GlassCard style={styles.container}>
          <Text style={[styles.title, { fontFamily: "HoopCheckDisplay", fontWeight: "400" }]}>Choose a new password</Text>
          <Text style={styles.subtitle}>Use at least 8 characters. This updates the password for your HoopCheck account.</Text>
          <Text style={styles.label}>New password</Text>
          <Input placeholderTextColor={theme.muted} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" style={styles.input} placeholder="At least 8 characters" />
          <Text style={styles.label}>Confirm new password</Text>
          <Input placeholderTextColor={theme.muted} value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" textContentType="newPassword" style={styles.input} placeholder="Enter it again" />
          <Button onPress={savePassword} disabled={busy || !ready} style={[styles.button, (busy || !ready) && styles.dim]}>
            <Text style={styles.buttonText}>{busy ? "Saving…" : ready ? "Update password" : "Validating recovery link…"}</Text>
          </Button>
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
  dim: { opacity: 0.65 }, buttonText: { color: theme.onButton, fontWeight: "800" },
});
