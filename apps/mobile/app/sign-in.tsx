import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase, supabaseConfigurationError } from "../src/lib/supabase";

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (supabaseConfigurationError) { Alert.alert("Setup required", supabaseConfigurationError); return; }
    if (!email.trim() || !password) { Alert.alert("Missing details", "Enter your email and password."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      router.replace("/dashboard");
    } catch (error) {
      Alert.alert("Could not sign in", error instanceof Error ? error.message : "Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue to HoopCheck.</Text>
          <Text style={styles.label}>Email</Text>
          <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#7A8798" style={styles.input} accessibilityLabel="Email" />
          <Text style={styles.label}>Password</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="Your password" placeholderTextColor="#7A8798" secureTextEntry autoComplete="password" style={styles.input} accessibilityLabel="Password" />
          <Link href="/forgot-password" style={styles.link}>Forgot password?</Link>
          <Pressable onPress={signIn} disabled={busy} style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonDim]}>
            <Text style={styles.buttonText}>{busy ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
          <Text style={styles.signupPrompt}>New to HoopCheck? <Link href="/sign-up" style={styles.link}>Create an account</Link></Text>
          <Link href="/" style={styles.backLink}>Back to welcome</Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#050505" }, flex: { flex: 1 },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 24 },
  title: { color: "#FFFFFF", fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#BDBDBD", fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  label: { color: "#253247", fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  input: { minHeight: 50, borderColor: "#D5DCE5", borderWidth: 1, borderRadius: 10, backgroundColor: "#111111", paddingHorizontal: 14, color: "#FFFFFF", fontSize: 16 },
  link: { color: "#263B59", fontWeight: "700" },
  button: { minHeight: 52, borderRadius: 10, backgroundColor: "#050505", alignItems: "center", justifyContent: "center", marginTop: 24 },
  buttonDim: { opacity: 0.7 }, buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  signupPrompt: { color: "#BDBDBD", textAlign: "center", marginTop: 22 },
  backLink: { color: "#263B59", textAlign: "center", fontWeight: "700", marginTop: 24 },
})
