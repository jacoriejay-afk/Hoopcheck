import { AlternateIcons } from "../components/AlternateIcons";
import { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useDevicePreferences } from "../src/native/preferences";
import { useEntryTheme } from "../src/theme";

export default function Settings() {
  const theme = useEntryTheme();
  const { preferences, update } = useDevicePreferences();
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
  return <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 24, gap: 24 }}>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 30, fontWeight: "900" }}>Settings</Text>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}><Text style={{ color: theme.foreground, fontSize: 17 }}>Haptics</Text><Switch accessibilityLabel="Haptics" value={preferences.haptics} onValueChange={value => void update({ haptics: value }).catch(() => setError("Couldn’t save haptics preference."))} /></View>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}><Text style={{ color: theme.foreground, fontSize: 17 }}>Face ID / device app lock</Text><Switch accessibilityLabel="Device app lock" disabled={busy} value={preferences.appLock} onValueChange={value => void setLock(value)} /></View>
    <Text style={{ color: theme.muted, lineHeight: 22 }}>Lock after five minutes in the background. Device passcode and normal sign-in remain available. Motion follows your device’s Reduce Motion setting.</Text>
    <AlternateIcons />
    {error ? <Text accessibilityRole="alert" style={{ color: theme.accent }}>{error}</Text> : null}
  </ScrollView>;
}
