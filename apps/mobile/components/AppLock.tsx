import { useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { backgroundRequiresLock, consumeFreshSignIn, lockScreenRequired } from "../src/native/lockPolicy";
import { useDevicePreferences } from "../src/native/preferences";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";

export function AppLock({ authReady, protectedScreen }: { authReady: boolean; protectedScreen: boolean }) {
  const { ready, preferences } = useDevicePreferences();
  const theme = useEntryTheme();
  const leftAt = useRef<number | null>(null);
  const [locked, setLocked] = useState(true);
  const restored = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!protectedScreen) { restored.current = false; setLocked(true); return; }
    if (!ready || restored.current) return;
    restored.current = true;
    if (!preferences.appLock || consumeFreshSignIn()) { setLocked(false); return; }
    let active = true;
    void SecureStore.getItemAsync("hoopcheck-last-background").then(value => {
      if (active) setLocked(backgroundRequiresLock(value ? Number(value) : null, Date.now()));
    }).catch(() => { if (active) setLocked(true); });
    return () => { active = false; restored.current = false; };
  }, [ready, protectedScreen, preferences.appLock]);
  useEffect(() => {
    if (!protectedScreen || !preferences.appLock) return;
    const listener = AppState.addEventListener("change", state => {
      if (state === "background" && leftAt.current === null) {
        leftAt.current = Date.now();
        if (preferences.appLock) void SecureStore.setItemAsync("hoopcheck-last-background", String(leftAt.current)).catch(() => {});
      }
      if (state === "active" && leftAt.current !== null) {
        if (preferences.appLock && backgroundRequiresLock(leftAt.current, Date.now())) setLocked(true);
        leftAt.current = null;
        void SecureStore.deleteItemAsync("hoopcheck-last-background").catch(() => {});
      }
    });
    return () => listener.remove();
  }, [protectedScreen, preferences.appLock]);
  async function unlock() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock HoopCheck", disableDeviceFallback: false, fallbackLabel: "Use device passcode", cancelLabel: "Cancel" });
      if (result.success) { setLocked(false); setMessage(""); }
      else setMessage("Unable to unlock. Try again or use normal sign-in.");
    } catch { setMessage("Device unlock is unavailable. Use normal sign-in below."); }
    finally { setBusy(false); }
  }
  async function normalSignIn() {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) setMessage("Couldn’t sign out. Please try again.");
      else { setLocked(false); setMessage(""); }
    } catch { setMessage("Couldn’t prepare normal sign-in. Please try again."); }
    finally { setBusy(false); }
  }
  const bootstrapping = !authReady || !ready;
  return <Modal visible={lockScreenRequired(authReady, ready, protectedScreen, preferences.appLock, locked)} animationType="none" onRequestClose={() => {}}><View style={{ flex: 1, justifyContent: "center", backgroundColor: theme.background, padding: 28, gap: 24 }}>
    {bootstrapping ? <Text accessibilityLiveRegion="polite" style={{ color: theme.foreground }}>Preparing HoopCheck…</Text> : <>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 28, fontWeight: "900" }}>Unlock HoopCheck</Text>
    <Text style={{ color: theme.muted }}>Use Face ID, fingerprint, or your device passcode.</Text>
    <Pressable disabled={busy} onPress={() => void unlock()} style={{ minHeight: 48 }}><Text style={{ color: theme.accent, fontSize: 18 }}>Unlock</Text></Pressable>
    <Pressable disabled={busy} onPress={() => void normalSignIn()} style={{ minHeight: 48 }}><Text style={{ color: theme.accent, fontSize: 18 }}>Use normal sign-in</Text></Pressable>
    {message ? <Text accessibilityRole="alert" style={{ color: theme.foreground }}>{message}</Text> : null}
    </>}
  </View></Modal>;
}
