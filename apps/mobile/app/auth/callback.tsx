import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase, supabaseConfigurationError } from "../../src/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [message, setMessage] = useState("Completing Google sign-in…");

  useEffect(() => {
    let active = true;
    async function complete() {
      try {
        if (supabaseConfigurationError) throw new Error(supabaseConfigurationError);
        if (error_description) throw new Error("Google sign-in was cancelled or denied.");
        if (!code || typeof code !== "string") throw new Error("Google sign-in returned no authorization code.");
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (!data.user) throw new Error("Google sign-in did not return a user.");
        const profile = await supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
        if (active) router.replace(profile.data && !profile.data.username?.trim() ? "/choose-username" : "/dashboard");
      } catch {
        if (active) {
          setMessage("Could not complete Google sign-in. Please return to Sign in and try again.");
        }
      }
    }
    void complete();
    return () => { active = false; };
  }, [code, error_description, router]);

  return <View style={styles.container}>
    <ActivityIndicator color="#FF6A00" />
    <Text style={styles.message}>{message}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505", justifyContent: "center", alignItems: "center", padding: 24 },
  message: { color: "#FFFFFF", textAlign: "center", marginTop: 16 },
});
