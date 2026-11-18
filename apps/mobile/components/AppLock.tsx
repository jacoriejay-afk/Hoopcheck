import { Onboarding } from "./Onboarding";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { backgroundRequiresLock, consumeFreshSignIn, lockScreenRequired } from "../src/native/lockPolicy";
import { readWithDeadline } from "../src/native/readDeadline";
import { useDevicePreferences } from "../src/native/preferences";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";

type Props = { authReady: boolean; protectedScreen: boolean; userId: string | null; startupError?: string | null; retryStartup?: () => void };
export function AppLock({ authReady, protectedScreen, userId, startupError, retryStartup }: Props) {
  const { ready, preferences, restoreError, retryRestore } = useDevicePreferences();
  const theme = useEntryTheme();
  const leftAt = useRef<number | null>(null);
  const [unlockedUser, setUnlockedUser] = useState<string | null>(null);
  const identity = useRef(userId);
  useLayoutEffect(() => { identity.current = userId; }, [userId]);
  const operation = useRef(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const current = ++operation.current;
    leftAt.current = null;
    setUnlockedUser(null); setBusy(false); setMessage("");
    if (!protectedScreen || !ready || !userId) return;
    if (!preferences.appLock || consumeFreshSignIn(userId)) { setUnlockedUser(userId); return; }
    let active = true;
    void readWithDeadline(() => SecureStore.getItemAsync(`hoopcheck-last-background-${userId}`)).then(value => {
      if (active && current === operation.current && identity.current === userId && !backgroundRequiresLock(value ? Number(value) : null, Date.now())) setUnlockedUser(userId);
    }).catch(() => { if (active) setMessage("Device lock state couldn’t be restored. Unlock below to continue."); });
    return () => { active = false; operation.current++; };
  }, [ready, protectedScreen, preferences.appLock, userId]);
  useEffect(() => {
    if (!protectedScreen || !preferences.appLock || !userId) return;
    const listener = AppState.addEventListener("change", state => {
      if (state === "background" && leftAt.current === null) {
        leftAt.current = Date.now();
        // A background transition invalidates an in-flight Face ID result.
        operation.current++; setBusy(false);
        void SecureStore.setItemAsync(`hoopcheck-last-background-${userId}`, String(leftAt.current)).catch(() => {});
      }
      if (state === "active" && leftAt.current !== null) {
        if (backgroundRequiresLock(leftAt.current, Date.now())) setUnlockedUser(null);
        leftAt.current = null;
        void SecureStore.deleteItemAsync(`hoopcheck-last-background-${userId}`).catch(() => {});
      }
    });
    return () => listener.remove();
  }, [protectedScreen, preferences.appLock, userId]);
  async function unlock() {
    if (busy || !userId) return;
    const current = ++operation.current;
    setBusy(true); setMessage("");
    try {
      const result = await readWithDeadline(() => LocalAuthentication.authenticateAsync({ promptMessage: "Unlock HoopCheck", disableDeviceFallback: false, fallbackLabel: "Use device passcode", cancelLabel: "Cancel" }), 30000);
      if (current !== operation.current || identity.current !== userId) return;
      if (result.success) { setUnlockedUser(userId); setMessage(""); }
      else setMessage("Unable to unlock. Try again or use normal sign-in.");
    } catch {
      if (current === operation.current && identity.current === userId) setMessage("Device unlock did not finish. Try again or use normal sign-in below.");
    } finally {
      // Invalidate late bridge results after the deadline as well as account changes.
      if (current === operation.current) { operation.current++; setBusy(false); }
    }
  }
  async function normalSignIn() {
    if (busy || !userId) return;
    const current = ++operation.current;
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (current !== operation.current || identity.current !== userId) return;
      if (error) setMessage("Couldn’t sign out. Please try again.");
      // Only the actual SIGNED_OUT event may reveal the sign-in screen.
    } catch {
      if (current === operation.current && identity.current === userId) setMessage("Couldn’t prepare normal sign-in. Please try again.");
    } finally { if (current === operation.current) setBusy(false); }
  }
  const bootstrapping = !authReady || !ready;
  const needsLock = lockScreenRequired(authReady, ready, protectedScreen, preferences.appLock, !userId || unlockedUser !== userId);
  const needsOnboarding = ready && !preferences.onboardingDone;
  const recoveryMessage = startupError || restoreError;
  // One native presentation owns hydration, recovery, locking and onboarding.
  if (!needsLock && !needsOnboarding) return null;
  return <Modal visible={true} animationType="none" onRequestClose={() => {}}>{!needsLock ? <Onboarding /> : <View style={{ flex: 1, justifyContent: "center", backgroundColor: theme.background, padding: 28, gap: 24 }}>
    {bootstrapping ? <>
      <Text accessibilityLiveRegion="polite" style={{ color: theme.foreground }}>{recoveryMessage || "Preparing HoopCheck…"}</Text>
      {recoveryMessage ? <Pressable accessibilityRole="button" onPress={() => { if (startupError) retryStartup?.(); if (restoreError) void retryRestore(); }} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: theme.accent, fontSize: 18 }}>Try again</Text></Pressable> : null}
    </> : <>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 28, fontWeight: "900" }}>Unlock HoopCheck</Text>
    <Text style={{ color: theme.muted }}>Use Face ID, fingerprint, or your device passcode.</Text>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void unlock()} style={{ minHeight: 48 }}><Text style={{ color: theme.accent, fontSize: 18 }}>{busy ? "Please wait…" : "Unlock"}</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void normalSignIn()} style={{ minHeight: 48 }}><Text style={{ color: theme.accent, fontSize: 18 }}>Use normal sign-in</Text></Pressable>
    {message ? <Text accessibilityRole="alert" style={{ color: theme.foreground }}>{message}</Text> : null}
    </>}
  </View>}</Modal>;
}
