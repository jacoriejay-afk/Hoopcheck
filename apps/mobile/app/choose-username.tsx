import { useEntryTheme } from "../src/theme";
import { takeDestination } from "../src/native/pendingDestination";
import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";
import UsernameField, { type UsernameFieldHandle } from "../components/UsernameField";

export default function ChooseUsernameScreen() {
 const theme = useEntryTheme();
 const styles = createStyles(theme);
  const router = useRouter();
  const fieldRef = useRef<UsernameFieldHandle>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error("Sign in again to save your username.");
      const session = data.session;
      const checked = await fieldRef.current?.validate();
      if (!checked?.valid) throw new Error(checked?.message || "Choose an available username.");
      const result = await supabase.rpc("save_my_username", { candidate_username: username.trim().toLowerCase() })
        .setHeader("Authorization", `Bearer ${session.access_token}`);
      const current = await supabase.auth.getSession();
      if (current.error || current.data.session?.user.id !== session.user.id) {
        throw new Error("The active account changed. Sign in again to continue.");
      }
      if (result.error) throw new Error(result.error.code === "23505" ? "That username is taken." : "Your username could not be saved. Try again.");
      router.replace((takeDestination() ?? "/dashboard") as "/dashboard");
    } catch (error) {
      Alert.alert("Username", error instanceof Error ? error.message : "Your username could not be saved.");
      fieldRef.current?.focus();
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>ONE-TIME ACCOUNT SETUP</Text>
          <Text style={styles.title}>Choose your username</Text>
          <Text style={styles.copy}>Your account remains accessible. Choose a username now, or skip and do it next time you sign in. You can always sign in with your email and password.</Text>
          <UsernameField ref={fieldRef} value={username} onChange={setUsername} disabled={busy} />
          <Pressable onPress={save} disabled={busy} style={styles.button}><Text style={styles.buttonText}>{busy ? "Saving…" : "Save username"}</Text></Pressable>
          <Pressable onPress={() => router.replace((takeDestination() ?? "/dashboard") as "/dashboard")} disabled={busy} style={styles.skip}><Text style={styles.skipText}>Skip for now</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const createStyles = (theme: ReturnType<typeof useEntryTheme>) => StyleSheet.create({
 safe:{flex:1,backgroundColor:theme.background},flex:{flex:1},container:{flexGrow:1,justifyContent:"center",padding:24},
 eyebrow:{color:theme.accent,fontSize:11,fontWeight:"900",letterSpacing:1.4},
 title:{color:theme.foreground,fontSize:28,fontWeight:"900",marginTop:10},
 copy:{color:theme.muted,fontSize:15,lineHeight:22,marginTop:10,marginBottom:18},
 button:{minHeight:52,backgroundColor: theme.button,borderRadius:10,alignItems:"center",justifyContent:"center",marginTop:24},
 buttonText:{color: theme.onButton,fontSize:16,fontWeight:"900"},
 skip:{padding:16,alignItems:"center"},skipText:{color:theme.muted,fontWeight:"700"},
});
