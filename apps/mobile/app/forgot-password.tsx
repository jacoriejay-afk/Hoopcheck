import { GlassCard, Input, Button } from "../src/primitives";
import { useEntryTheme, type EntryTheme } from "../src/theme";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase, supabaseConfigurationError } from "../src/lib/supabase";

export default function ForgotPasswordScreen() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendReset() {
    if (supabaseConfigurationError) { Alert.alert("Setup required", supabaseConfigurationError); return; }
    if (!email.trim()) { Alert.alert("Email required", "Enter the email address associated with your account."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: "hoopcheck://reset-password" });
      if (error) throw error;
      Alert.alert("Check your email", "If an account exists for that address, password recovery instructions will be sent. Open the recovery link on this device to choose a new password.");
    } catch {
      Alert.alert("Could not request reset", "Please check your details and try again.");
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingVertical: 16 }}>
        <GlassCard style={styles.container}>
          <Text style={[styles.title, { fontFamily: "HoopCheckDisplay", fontWeight: "400" }]}>Reset password</Text>
          <Text style={styles.subtitle}>Enter your account email to request a recovery message.</Text>
          <Text style={styles.label}>Email</Text>
          <Input accessibilityLabel="Email" placeholderTextColor={theme.muted} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" style={styles.input} placeholder="you@example.com" />
          <Button onPress={sendReset} disabled={busy} style={[styles.button, busy && styles.dim]}><Text style={styles.buttonText}>{busy ? "Sending…" : "Send recovery email"}</Text></Button>
          <Link href="/sign-in" style={styles.link}>Back to sign in</Link>
        </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const createStyles = (theme: EntryTheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background }, flex: { flex: 1 },
  container: { margin: 16, justifyContent: "center", padding: 16 },
  title: { fontSize: 29, fontWeight: "800", color: theme.foreground },
  subtitle: { color: theme.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  label: { color: theme.foreground, fontWeight: "700", marginBottom: 8 },
  input: { minHeight: 50, borderColor: theme.border, borderWidth: 1, borderRadius: theme.radius.control, backgroundColor: theme.input, paddingHorizontal: 14, color: theme.foreground, fontSize: 16 },
  button: { minHeight: 52, borderRadius: theme.radius.control, backgroundColor: theme.button, alignItems: "center", justifyContent: "center", marginTop: 24 },
  dim: { opacity: 0.65 }, buttonText: { color: theme.onButton, fontWeight: "800" },
  link: { color: theme.accent, fontWeight: "700", textAlign: "center", marginTop: 24 },
});
