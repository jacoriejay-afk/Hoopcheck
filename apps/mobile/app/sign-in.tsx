import { BrandLockup } from "../components/BrandLockup";
import { recordFreshSignIn } from "../src/native/lockPolicy";
import { takeDestination } from "../src/native/pendingDestination";
import { GlassCard, Input, Button } from "../src/primitives";
import { useNativeCaptcha } from "../components/NativeCaptcha";
import { useEntryTheme, type EntryTheme } from "../src/theme";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { Link, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase, supabaseConfigurationError } from "../src/lib/supabase";

export default function SignInScreen() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const captcha = useNativeCaptcha();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (busy) return;
    if (supabaseConfigurationError) { Alert.alert("Setup required", supabaseConfigurationError); return; }
    if (!email.trim() || !password) { Alert.alert("Missing details", "Enter your email and password."); return; }
    setBusy(true);
    let stage: "authentication" | "profile" = "authentication";
    try {
      const captchaToken = await captcha.requestToken();
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password, ...(captchaToken ? { options: { captchaToken } } : {}) });
      if (error) throw error;
      stage = "profile";
      const profile = data.user ? await supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle() : null;
      recordFreshSignIn();
      router.replace((profile?.data && !profile.data.username?.trim() ? "/choose-username" : takeDestination() ?? "/dashboard") as "/dashboard");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Please try again.";
      Alert.alert(stage === "authentication" ? "Authentication failed" : "Profile loading failed", detail);
    } finally { setBusy(false); }
  }

  async function signInWithGoogle() {
    if (supabaseConfigurationError) { Alert.alert("Setup required", supabaseConfigurationError); return; }
    setBusy(true);
    try {
      const redirectTo = Linking.createURL("auth/callback");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error("Google sign-in URL was not returned.");
      await Linking.openURL(data.url);
    } catch (error) {
      Alert.alert("Google sign-in unavailable", error instanceof Error ? error.message : "Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <GlassCard style={styles.container}>
          <BrandLockup size={44} animated />
          <Text style={[styles.title, { fontFamily: "HoopCheckDisplay", fontWeight: "400" }]}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue to HoopCheck.</Text>
          <Text style={styles.label}>Email</Text>
          <Input autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={theme.muted} style={styles.input} accessibilityLabel="Email" />
          <Text style={styles.label}>Password</Text>
          <Input value={password} onChangeText={setPassword} placeholder="Your password" placeholderTextColor={theme.muted} secureTextEntry autoComplete="password" style={styles.input} accessibilityLabel="Password" />
          <Link href="/forgot-password" style={styles.link}>Forgot password?</Link>
          <Button onPress={signIn} disabled={busy} style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonDim]}>
            <Text style={styles.buttonText}>{busy ? "Signing in…" : "Sign in"}</Text>
          </Button>
          <Button secondary accessibilityLabel="Continue with Google" onPress={signInWithGoogle} disabled={busy} style={styles.googleButton}>Continue with Google</Button>
          <Text style={styles.signupPrompt}>New to HoopCheck? <Link href="/sign-up" style={styles.link}>Create an account</Link></Text>
          <Link href="/" style={styles.backLink}>Back to welcome</Link>
        </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
      {captcha.challenge}
    </SafeAreaView>
  );
}

const createStyles = (theme: EntryTheme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background }, flex: { flex: 1 },
  container: { margin: 24, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 24 },
  title: { color: theme.foreground, fontSize: 30, fontWeight: "800" },
  subtitle: { color: theme.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  label: { color: theme.foreground, fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  input: { minHeight: 50, borderColor: theme.border, borderWidth: 1, borderRadius: theme.radius.control, backgroundColor: theme.input, paddingHorizontal: 14, color: theme.foreground, fontSize: 16 },
  link: { color: theme.accent, fontWeight: "700" },
  button: { minHeight: 52, borderRadius: theme.radius.control, backgroundColor: theme.button, alignItems: "center", justifyContent: "center", marginTop: 24 },
  buttonDim: { opacity: 0.7 }, buttonText: { color: theme.onButton, fontSize: 16, fontWeight: "800" },
  googleButton: { marginTop: 12 },
  signupPrompt: { color: theme.muted, textAlign: "center", marginTop: 22 },
  backLink: { color: theme.accent, textAlign: "center", fontWeight: "700", marginTop: 24 },
})
