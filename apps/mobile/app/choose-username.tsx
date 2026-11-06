import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";
import UsernameField, { type UsernameFieldHandle } from "../components/UsernameField";

export default function ChooseUsernameScreen() {
  const router = useRouter();
  const fieldRef = useRef<UsernameFieldHandle>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    const checked = await fieldRef.current?.validate();
    if (!checked?.valid) {
      Alert.alert("Username", checked?.message || "Choose an available username.");
      fieldRef.current?.focus();
      setBusy(false);
      return;
    }
    const { error } = await supabase.rpc("save_my_username", { candidate_username: username.trim().toLowerCase() });
    if (error) {
      Alert.alert("Username", error.message || "That username could not be saved.");
      fieldRef.current?.focus();
      setBusy(false);
      return;
    }
    router.replace("/dashboard");
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
          <Pressable onPress={() => router.replace("/dashboard")} disabled={busy} style={styles.skip}><Text style={styles.skipText}>Skip for now</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#050505"},flex:{flex:1},container:{flexGrow:1,justifyContent:"center",padding:24},
 eyebrow:{color:"#FF6A00",fontSize:11,fontWeight:"900",letterSpacing:1.4},
 title:{color:"#FFFFFF",fontSize:28,fontWeight:"900",marginTop:10},
 copy:{color:"#BDBDBD",fontSize:15,lineHeight:22,marginTop:10,marginBottom:18},
 button:{minHeight:52,backgroundColor:"#FF6A00",borderRadius:10,alignItems:"center",justifyContent:"center",marginTop:24},
 buttonText:{color:"#111111",fontSize:16,fontWeight:"900"},
 skip:{padding:16,alignItems:"center"},skipText:{color:"#BDBDBD",fontWeight:"700"},
});
