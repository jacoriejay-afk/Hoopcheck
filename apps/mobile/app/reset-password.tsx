import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase, supabaseConfigurationError } from "../src/lib/supabase";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[]; error_description?: string | string[] }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const recoveryError = Array.isArray(params.error_description) ? params.error_description[0] : params.error_description;
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
        if (alive) Alert.alert("Recovery link invalid", recoveryError);
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
        <View style={styles.container}>
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.subtitle}>Use at least 8 characters. This updates the password for your HoopCheck account.</Text>
          <Text style={styles.label}>New password</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" style={styles.input} placeholder="At least 8 characters" />
          <Text style={styles.label}>Confirm new password</Text>
          <TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" textContentType="newPassword" style={styles.input} placeholder="Enter it again" />
          <Pressable onPress={savePassword} disabled={busy || !ready} style={[styles.button, (busy || !ready) && styles.dim]}>
            <Text style={styles.buttonText}>{busy ? "Saving…" : ready ? "Update password" : "Validating recovery link…"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050505" }, flex: { flex: 1 },
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "800", color: "#FFFFFF" },
  subtitle: { color: "#BDBDBD", fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  label: { color: "#253247", fontWeight: "700", marginBottom: 8, marginTop: 14 },
  input: { minHeight: 50, borderColor: "#D5DCE5", borderWidth: 1, borderRadius: 10, backgroundColor: "#111111", paddingHorizontal: 14, color: "#FFFFFF", fontSize: 16 },
  button: { minHeight: 52, borderRadius: 10, backgroundColor: "#050505", alignItems: "center", justifyContent: "center", marginTop: 24 },
  dim: { opacity: 0.65 }, buttonText: { color: "#FFFFFF", fontWeight: "800" },
});
