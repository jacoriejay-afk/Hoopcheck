import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase, supabaseConfigurationError } from "../src/lib/supabase";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendReset() {
    if (supabaseConfigurationError) { Alert.alert("Setup required", supabaseConfigurationError); return; }
    if (!email.trim()) { Alert.alert("Email required", "Enter the email address associated with your account."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      if (error) throw error;
      Alert.alert("Check your email", "If an account exists for that address, password recovery instructions will be sent. The recovery callback/deep link must be configured and tested before store release.");
    } catch (error) {
      Alert.alert("Could not request reset", error instanceof Error ? error.message : "Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>Enter your account email to request a recovery message.</Text>
          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" style={styles.input} placeholder="you@example.com" />
          <Pressable onPress={sendReset} disabled={busy} style={[styles.button, busy && styles.dim]}><Text style={styles.buttonText}>{busy ? "Sending…" : "Send recovery email"}</Text></Pressable>
          <Link href="/sign-in" style={styles.link}>Back to sign in</Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FA" }, flex: { flex: 1 },
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 29, fontWeight: "800", color: "#101827" },
  subtitle: { color: "#586579", fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  label: { color: "#253247", fontWeight: "700", marginBottom: 8 },
  input: { minHeight: 50, borderColor: "#D5DCE5", borderWidth: 1, borderRadius: 10, backgroundColor: "#FFFFFF", paddingHorizontal: 14, color: "#101827", fontSize: 16 },
  button: { minHeight: 52, borderRadius: 10, backgroundColor: "#101827", alignItems: "center", justifyContent: "center", marginTop: 24 },
  dim: { opacity: 0.65 }, buttonText: { color: "#FFFFFF", fontWeight: "800" },
  link: { color: "#263B59", fontWeight: "700", textAlign: "center", marginTop: 24 },
});
