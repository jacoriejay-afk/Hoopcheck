import { takeDestination } from "../../src/native/pendingDestination";
import { recordFreshSignIn } from "../../src/native/lockPolicy";
import { useEntryTheme, type EntryTheme } from "../../src/theme";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase, supabaseConfigurationError } from "../../src/lib/supabase";

export default function AuthCallback() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { code, error_description, error: oauthError } = useLocalSearchParams<{ code?: string; error_description?: string; error?: string }>();
  const [message, setMessage] = useState("Completing Google sign-in…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function complete() {
      try {
        if (supabaseConfigurationError) throw new Error(supabaseConfigurationError);
        if (error_description || oauthError) throw new Error("Google sign-in was cancelled or denied.");
        if (!code || typeof code !== "string") throw new Error("Google sign-in returned no authorization code.");
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (!data.user) throw new Error("Google sign-in did not return a user.");
        recordFreshSignIn(data.user.id);
        const profile = await supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
        if (active) router.replace((profile.data && !profile.data.username?.trim() ? "/choose-username" : takeDestination() ?? "/dashboard") as "/dashboard");
      } catch {
        if (active) {
          setMessage("Could not complete Google sign-in. Please try again.");
          setFailed(true);
        }
      }
    }
    void complete();
    return () => { active = false; };
  }, [code, error_description, oauthError, router]);

  return <View style={styles.container}>
    {!failed ? <ActivityIndicator color={theme.accent} /> : null}
    <Text style={styles.message}>{message}</Text>
    {failed ? <Pressable accessibilityRole="button" onPress={() => router.replace("/sign-in")} style={styles.retry}><Text style={styles.retryText}>Return to sign in</Text></Pressable> : null}
  </View>;
}

const createStyles = (theme: EntryTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background, justifyContent: "center", alignItems: "center", padding: 24 },
  message: { color: theme.foreground, textAlign: "center", marginTop: 16 },
  retry: { backgroundColor: theme.button, paddingVertical: 14, paddingHorizontal: 20, borderRadius: theme.radius.control, marginTop: 20 },
  retryText: { color: theme.onButton, fontWeight: "700" },
});
