import { AlternateIcons } from "../components/AlternateIcons";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useDevicePreferences } from "../src/native/preferences";
import { useEntryTheme } from "../src/theme";

export default function Settings() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { preferences, update } = useDevicePreferences();
  const [themeBusy, setThemeBusy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function setLock(enabled: boolean) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (enabled) {
        if (!await LocalAuthentication.isEnrolledAsync()) { setError("Set up device authentication first. Normal sign-in remains available."); return; }
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Enable HoopCheck app lock", disableDeviceFallback: false });
        if (!result.success) { setError("App lock was not enabled. You can try again."); return; }
      }
      await update({ appLock: enabled });
    } catch { setError("Unable to save app lock. Please try again."); }
    finally { setBusy(false); }
  }
  return <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}><Text style={{ color: theme.foreground, fontSize: 17 }}>Haptics</Text><Switch accessibilityLabel="Haptics" value={preferences.haptics} onValueChange={value => void update({ haptics: value }).catch(() => setError("Couldn’t save haptics preference."))} /></View>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}><Text style={{ color: theme.foreground, fontSize: 17 }}>Face ID / device app lock</Text><Switch accessibilityLabel="Device app lock" disabled={busy} value={preferences.appLock} onValueChange={value => void setLock(value)} /></View>
    <Text style={{ color: theme.muted, lineHeight: 22 }}>Lock after five minutes in the background. Device passcode and normal sign-in remain available. Motion follows your device’s Reduce Motion setting.</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={{ gap: 8 }}>
      <Text style={{ color: theme.foreground, fontSize: 19, fontWeight: "800" }}>Appearance</Text>
      {(["system", "light", "dark"] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={value === "system" ? "Use device theme" : `${value === "light" ? "Light" : "Dark"} theme`} accessibilityState={{ checked: preferences.theme === value, disabled: themeBusy }} aria-checked={preferences.theme === value} aria-disabled={themeBusy} disabled={themeBusy} onPress={() => {
        setThemeBusy(true); setError("");
        void update({ theme: value }).catch(() => setError("Couldn’t save appearance. Please try again.")).finally(() => setThemeBusy(false));
      }} style={{ minHeight: 48, justifyContent: "center", borderRadius: theme.radius.control, paddingHorizontal: 16, backgroundColor: preferences.theme === value ? theme.accentSurface : theme.surface, borderWidth: 1, borderColor: preferences.theme === value ? theme.accent : theme.border }}>
        <Text style={{ color: theme.foreground }}>{value === "system" ? "Use device theme" : value === "light" ? "Light" : "Dark"}{preferences.theme === value ? " ✓" : ""}</Text>
      </Pressable>)}
    </View>
    <View style={{gap:10}}><Text style={{color:theme.foreground,fontSize:19,fontWeight:"800"}}>Account & community</Text>
      {([{title:"Account and profile",path:"/account"},{title:"Messages and requests",path:"/messages"},{title:"Basketball alerts",path:"/notifications"},{title:"Account security",path:"/account/security"}] as const).map(item=><Pressable key={item.path} accessibilityRole="button" onPress={()=>router.push(item.path)}
        style={{minHeight:48,justifyContent:"center",borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface,paddingHorizontal:14,borderRadius:theme.radius.control}}>
          <Text style={{color:theme.foreground,fontWeight:"700"}}>{item.title}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" onPress={()=>router.push({pathname:"/web",params:{path:"/privacy-center"}})}
        style={{minHeight:48,justifyContent:"center",borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface,paddingHorizontal:14,borderRadius:theme.radius.control}}>
        <Text style={{color:theme.foreground,fontWeight:"700"}}>Privacy center</Text>
      </Pressable>
    </View>
    <View style={{ gap: 10 }}>
      <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 19, fontWeight: "800" }}>Career & team reviews</Text>
      <Text style={{ color: theme.muted, lineHeight: 20 }}>Save playing history first. Reviews are optional and require verification.</Text>
      {([{ title: "Career Passport · My Journey", path: "/profile#career-passport" },
         { title: "Team review checklist", path: "/account#team-review-checklist" },
         { title: "Membership & billing", path: "/membership" }] as const).map(item =>
        <Pressable key={item.path} accessibilityRole="link"
          onPress={() => router.push({ pathname: "/web", params: { path: item.path } })}
          style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: theme.radius.control }}>
          <Text style={{ color: theme.foreground, fontWeight: "700" }}>{item.title}</Text>
        </Pressable>)}
    </View>
    <AlternateIcons />
    {error ? <Text accessibilityRole="alert" style={{ color: theme.accent }}>{error}</Text> : null}
  </ScrollView>;
}
