import { recordFreshSignIn } from "../src/native/lockPolicy";
import { takeDestination } from "../src/native/pendingDestination";
import { Input, Button } from "../src/primitives";
import { ArenaBrand } from "../components/ArenaBrand";
import { useMotionSetting } from "../src/motion/Provider";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useEntryTheme, type EntryTheme } from "../src/theme";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase, supabaseConfigurationError } from "../src/lib/supabase";

export default function SignInScreen() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const reduced = useMotionSetting();
  const entry = useSharedValue(reduced ? 1 : 0);
  useEffect(() => { entry.set(withTiming(1, { duration: reduced ? 0 : 620 })); }, [entry, reduced]);
  const heroMotion = useAnimatedStyle(() => ({ opacity: .2 + entry.get() * .8,
    transform: [{ translateY: 15 * (1 - entry.get()) }, { scale: .94 + entry.get() * .06 }] }));
  const formMotion = useAnimatedStyle(() => ({ opacity: .2 + entry.get() * .8,
    transform: [{ translateY: 22 * (1 - entry.get()) }] }));

  async function signIn() {
    if (supabaseConfigurationError) { Alert.alert("Setup required", supabaseConfigurationError); return; }
    if (!email.trim() || !password) { Alert.alert("Missing details", "Enter your email and password."); return; }
    setBusy(true);
    let stage: "authentication" | "profile" = "authentication";
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      if (!data.user) throw new Error("Sign-in did not return an account. Please try again.");
      stage = "profile";
      const profile = data.user ? await supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle() : null;
      recordFreshSignIn(data.user.id);
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
      <LinearGradient colors={["#061225", "#162B47", "#301A2A"]} start={{ x:0, y:0 }}
        end={{ x:1, y:1 }} style={StyleSheet.absoluteFill}/>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}>
          <Animated.View style={[styles.brand, heroMotion]}>
            <ArenaBrand size={98} compact />
            <Text style={styles.brandTagline}>YOUR COURT. YOUR CREDENTIALS.</Text>
          </Animated.View>
          <Animated.View style={[styles.container, formMotion]}>
            <LinearGradient colors={["rgba(43,65,96,.86)", "rgba(17,29,48,.97)"]}
              start={{x:0,y:0}} end={{x:1,y:1}}
              style={[StyleSheet.absoluteFill, {borderRadius:22}]}/>
            <View style={styles.edge} pointerEvents="none"/>
            <Text accessibilityRole="header" style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your HoopCheck account.</Text>
            <Text style={styles.label}>Email</Text>
            <View style={styles.field}>
              <Ionicons name="mail-outline" size={20} color="#FFAE80"/>
              <Input autoCapitalize="none" autoComplete="email" keyboardType="email-address"
                value={email} onChangeText={setEmail} placeholder="you@example.com"
                placeholderTextColor="#9DACBF" style={styles.input} accessibilityLabel="Email"/>
            </View>
            <View style={styles.passwordHeader}>
              <Text style={styles.label}>Password</Text>
              <Link href="/forgot-password" style={styles.link}>Forgot password?</Link>
            </View>
            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={20} color="#FFAE80"/>
              <Input value={password} onChangeText={setPassword}
                placeholder="Your password" placeholderTextColor="#9DACBF"
                secureTextEntry={!showPassword} autoComplete="password"
                style={styles.input} accessibilityLabel="Password"/>
              <Pressable accessibilityRole="button"
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                onPress={() => setShowPassword(v => !v)}
                style={styles.eye}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={21} color="#D0DEEE"/>
              </Pressable>
            </View>
            <Button onPress={signIn} disabled={busy} style={({pressed}) => [
              styles.button, (pressed || busy) && styles.buttonDim,
            ]}>
              <Text style={styles.buttonText}>{busy ? "Signing in…" : "Sign in"}</Text>
            </Button>
            <View style={styles.dividerRow}><View style={styles.line}/>
              <Text style={styles.dividerText}>OR</Text><View style={styles.line}/></View>
            <Button secondary accessibilityLabel="Continue with Google"
              onPress={signInWithGoogle} disabled={busy} style={styles.googleButton}>
              <Ionicons name="logo-google" size={18} color="#FFFFFF"/>
              <Text style={styles.googleText}>Continue with Google</Text>
            </Button>
            <Text style={styles.signupPrompt}>New to HoopCheck?{" "}
              <Link href="/sign-up" style={styles.link}>Create an account</Link>
            </Text>
          </Animated.View>
          <Link href="/" style={styles.backLink}>Back to welcome</Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (_theme: EntryTheme) => StyleSheet.create({
  safeArea: { flex:1, backgroundColor:"#071426" }, flex:{flex:1},
  scroll: { flexGrow:1, justifyContent:"center", paddingHorizontal:18, paddingTop:25, paddingBottom:26 },
  brand: { alignItems:"center", marginTop:12, marginBottom:18, gap:10 },
  brandTagline: { fontSize:10, letterSpacing:1.6, color:"#E3EDF9", fontWeight:"700", textAlign:"center" },
  container: { borderRadius:22, borderWidth:1, borderColor:"rgba(132,176,239,.48)",
    paddingHorizontal:17, paddingVertical:20, overflow:"hidden" },
  edge: { position:"absolute",left:19,right:19,top:0,height:3,borderRadius:4,backgroundColor:"#FF762D" },
  title: { color:"#FFFFFF", fontSize:26, lineHeight:32, fontWeight:"700", fontFamily:Platform.select({ios:"AvenirNext-DemiBold",android:"sans-serif-medium",default:"Arial"}) },
  subtitle: { color:"#BFD1E6", fontSize:13, lineHeight:19, marginTop:3, marginBottom:10 },
  label: { color:"#EFF4FC", fontSize:13, fontWeight:"700", marginBottom:7, marginTop:13 },
  field: { minHeight:50, borderWidth:1, borderColor:"rgba(157,189,229,.36)",
    borderRadius:14, backgroundColor:"rgba(9,19,36,.72)", paddingLeft:13, paddingRight:4,
    flexDirection:"row", alignItems:"center", gap:8 },
  input: { flex:1, minWidth:0, borderWidth:0, minHeight:48, paddingHorizontal:0,
    backgroundColor:"transparent", color:"#FFFFFF", fontSize:15 },
  passwordHeader: { flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  eye: { width:44, height:48, justifyContent:"center", alignItems:"center" },
  link: { color:"#FFAB78", fontWeight:"700", fontSize:12 },
  button: { minHeight:52, borderRadius:14, backgroundColor:"#FF6A25",
    borderColor:"#FF8B41", alignItems:"center",justifyContent:"center", marginTop:22 },
  buttonDim:{opacity:.7},
  buttonText:{color:"#FFFFFF",fontSize:16,fontWeight:"800"},
  dividerRow:{ flexDirection:"row",alignItems:"center",gap:12,marginTop:18,marginBottom:6 },
  line:{ flex:1,height:1,backgroundColor:"rgba(215,227,248,.2)" },
  dividerText:{color:"#9DACBF",fontSize:11,fontWeight:"700",letterSpacing:1.2},
  googleButton:{minHeight:52,marginTop:6,borderRadius:14,backgroundColor:"rgba(255,255,255,.075)",
    borderColor:"rgba(178,201,239,.4)",flexDirection:"row",gap:11},
  googleText:{color:"#FFFFFF",fontWeight:"700",fontSize:14},
  signupPrompt:{color:"#C0D0E4",textAlign:"center",marginTop:20,fontSize:13},
  backLink:{color:"#C5D8ED",textAlign:"center",fontWeight:"700",fontSize:12,marginTop:19},
});
