import { BlockedAccounts } from "../components/BlockedAccounts";
import { AdminSafetyCenter } from "../components/AdminSafetyCenter";
import { AlternateIcons } from "../components/AlternateIcons";
import { useRef, useState } from "react";
import { clearPublicCache } from "../src/native/cache";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNativeAccount } from "../src/native/useNativeAccount";
import * as LocalAuthentication from "expo-local-authentication";
import { useDevicePreferences } from "../src/native/preferences";
import { useEntryTheme } from "../src/theme";

export default function Settings() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { preferences, update } = useDevicePreferences();
  const { account, loading: accountLoading, error: accountError, retry: retryAccount } = useNativeAccount();
  const [themeBusy, setThemeBusy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const clearingCache = useRef(false);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cacheMessage, setCacheMessage] = useState("");
  async function clearCachedDirectoryData() {
    if (clearingCache.current) return;
    clearingCache.current = true;
    setCacheBusy(true);
    setCacheMessage("");
    try {
      await clearPublicCache();
      setCacheMessage("Cached directory data cleared. It will be downloaded again as needed.");
    } catch {
      setCacheMessage("Could not clear cached directory data. Please try again.");
    } finally {
      clearingCache.current = false;
      setCacheBusy(false);
    }
  }
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
    <View style={{gap:5}}>
      <Text accessibilityRole="header" style={{color:theme.foreground,fontSize:21,fontFamily:"HoopCheckDisplay"}}>Account & community</Text>
      {([{title:"Account and profile",path:"/account",open:()=>router.push("/account"),icon:"person-circle-outline"},{title:"Edit profile & privacy",path:"/account/edit",open:()=>router.push("/account/edit"),icon:"create-outline"},{title:"Connections",path:"/connections",open:()=>router.push("/connections"),icon:"people-outline"},{title:"Membership & billing",path:"/membership",open:()=>router.push("/membership"),icon:"card-outline"},{title:"Alerts, HoopChat & requests",path:"/notifications",open:()=>router.push("/notifications"),icon:"notifications-outline"},{title:"Account security",path:"/account/security",open:()=>router.push("/account/security"),icon:"lock-closed-outline"},{title:"Help & Support",path:"/account/support",open:()=>router.push("/account/support"),icon:"help-circle-outline"}] as const).map(item=>
        <Pressable key={item.path} accessibilityRole="button" onPress={item.open}
          style={({pressed})=>({minHeight:48,flexDirection:"row",alignItems:"center",gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:theme.border,paddingHorizontal:4,backgroundColor:pressed?theme.accentSurface:"transparent"})}>
          <Ionicons name={item.icon} size={20} color={theme.accent}/>
          <Text style={{flex:1,color:theme.foreground,fontWeight:"700"}}>{item.title}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.muted}/>
        </Pressable>)}
    </View>
    {account?.workspaces?.owner || account?.workspaces?.ambassador ? <View style={{gap:5}}>
      <Text accessibilityRole="header" style={{color:theme.foreground,fontSize:21,fontFamily:"HoopCheckDisplay"}}>Private workspaces</Text>
      {account.workspaces.owner ? <Pressable testID="settings-owner-hq" accessibilityRole="button" onPress={()=>router.push("/account/owner-hq")} style={{minHeight:48,flexDirection:"row",alignItems:"center",gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:theme.border}}><Ionicons name="shield-checkmark-outline" size={20} color={theme.accent}/><Text style={{flex:1,color:theme.foreground,fontWeight:"700"}}>Owner HQ</Text><Ionicons name="chevron-forward" size={16} color={theme.muted}/></Pressable> : null}
      {account.workspaces.ambassador ? <Pressable testID="settings-ambassador-hq" accessibilityRole="button" onPress={()=>router.push("/account/ambassador-hq")} style={{minHeight:48,flexDirection:"row",alignItems:"center",gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:theme.border}}><Ionicons name="megaphone-outline" size={20} color={theme.accent}/><Text style={{flex:1,color:theme.foreground,fontWeight:"700"}}>Ambassador HQ</Text><Ionicons name="chevron-forward" size={16} color={theme.muted}/></Pressable> : null}
    </View> : null}
    {!account && !accountLoading && accountError ? <View style={{gap:6}}><Text accessibilityRole="alert" style={{color:theme.muted}}>{accountError}</Text><Pressable accessibilityRole="button" onPress={retryAccount} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:theme.accent,fontWeight:"700"}}>Retry account verification</Text></Pressable></View> : null}
    <BlockedAccounts />
    <AdminSafetyCenter />
    <Text accessibilityRole="header" style={{color:theme.foreground,fontSize:21,fontFamily:"HoopCheckDisplay"}}>Device preferences</Text>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}><Text style={{ color: theme.foreground, fontSize: 17 }}>Haptics</Text><Switch accessibilityLabel="Haptics" value={preferences.haptics} onValueChange={value => void update({ haptics: value }).catch(() => setError("Couldn’t save haptics preference."))} /></View>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}><Text style={{ color: theme.foreground, fontSize: 17 }}>Face ID / device app lock</Text><Switch accessibilityLabel="Device app lock" disabled={busy} value={preferences.appLock} onValueChange={value => void setLock(value)} /></View>
    <Text style={{ color: theme.muted, lineHeight: 22 }}>Lock after five minutes in the background. Device passcode and normal sign-in remain available. Motion follows your device’s Reduce Motion setting.</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={{ gap: 8 }}>
      <Text style={{ color: theme.foreground, fontSize: 21, fontFamily: "HoopCheckDisplay" }}>Appearance</Text>
      {(["system", "light", "dark", "midnight"] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={value === "system" ? "Use device theme" : `${value === "midnight" ? "Midnight Black" : value === "light" ? "Light" : "Dark"} theme`} accessibilityState={{ checked: preferences.theme === value, disabled: themeBusy }} aria-checked={preferences.theme === value} aria-disabled={themeBusy} disabled={themeBusy} onPress={() => {
        setThemeBusy(true); setError("");
        void update({ theme: value }).catch(() => setError("Couldn’t save appearance. Please try again.")).finally(() => setThemeBusy(false));
      }} style={{ minHeight: 48, justifyContent: "center", borderRadius: theme.radius.control, paddingHorizontal: 16, backgroundColor: preferences.theme === value ? theme.accentSurface : theme.surface, borderWidth: 1, borderColor: preferences.theme === value ? theme.accent : theme.border }}>
        <Text style={{ color: theme.foreground }}>{value === "system" ? "Use device theme" : value === "midnight" ? "Midnight Black" : value === "light" ? "Light" : "Dark"}{preferences.theme === value ? " ✓" : ""}</Text>
      </Pressable>)}
    </View>
    <View style={{ gap: 10 }}>
      <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 21, fontFamily: "HoopCheckDisplay" }}>Storage</Text>
      <Text style={{ color: theme.muted, lineHeight: 20 }}>Clear downloaded public directory data on this device. Your account, saved posts, drafts and preferences are not deleted. Directory pages may need an internet connection to reload.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Clear cached directory data" accessibilityState={{ disabled: cacheBusy, busy: cacheBusy }} disabled={cacheBusy} onPress={() => void clearCachedDirectoryData()} style={{ minHeight: 48, justifyContent: "center", borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: 14, borderRadius: theme.radius.control }}>
        <Text style={{ color: theme.foreground, fontWeight: "700" }}>{cacheBusy ? "Clearing cached data…" : "Clear cached directory data"}</Text>
      </Pressable>
      {cacheMessage ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: theme.foreground }}>{cacheMessage}</Text> : null}
    </View>
    <AlternateIcons />
    {error ? <Text accessibilityRole="alert" style={{ color: theme.accent }}>{error}</Text> : null}
  </ScrollView>;
}
