import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { verifyTotp, type MfaState } from "../../../lib/auth/mfa-core";
export function MfaChallenge({ state, onVerified }: { state: MfaState; onVerified: () => void }) {
  const theme = useEntryTheme(); const factors = state.factors.filter(factor => factor.verified && factor.type === "totp");
  const [selected, setSelected] = useState(factors[0]?.id ?? ""); const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const active = useRef(true);
  useEffect(() => { active.current = true; const listener = AppState.addEventListener("change", value => { if (value !== "active") setCode(""); }); return () => { active.current = false; listener.remove(); }; }, []);
  async function verify() {
    if (busy || !/^\d{6}$/.test(code)) return;
    const input = code; setCode(""); setBusy(true); setMessage("");
    try { await verifyTotp(supabase, state.owner, selected, input); if (active.current) onVerified(); }
    catch { if (active.current) setMessage("The code was not accepted. Use a fresh code and try again."); }
    finally { if (active.current) setBusy(false); }
  }
  async function signOut() {
    if (busy) return; setCode(""); setBusy(true); setMessage("");
    try { const result = await supabase.auth.signOut({ scope: "local" }); if (result.error) throw result.error; }
    catch { if (active.current) setMessage("Sign-out could not be confirmed. Please try again."); }
    finally { if (active.current) setBusy(false); }
  }
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 28, gap: 18, backgroundColor: theme.background }}>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 28, fontWeight: "900" }}>Verify your authenticator</Text>
    <Text style={{ color: theme.muted }}>Enter a current code to finish signing in. You can use a registered backup authenticator if your primary device is unavailable.</Text>
    {factors.length ? <>
      <View accessibilityRole="radiogroup" accessibilityLabel="Authenticator" style={{ gap: 8 }}>{factors.map(factor => <Pressable key={factor.id} accessibilityRole="radio" accessibilityLabel={factor.name} accessibilityState={{ checked: selected === factor.id }} disabled={busy} onPress={() => { setSelected(factor.id); setCode(""); }} style={{ minHeight: 48, padding: 12, borderWidth: 1, borderColor: selected === factor.id ? theme.accent : theme.border, borderRadius: 12 }}><Text style={{ color: theme.foreground }}>{factor.name}</Text></Pressable>)}</View>
      <TextInput testID="mfa-code" accessibilityLabel="Six-digit authenticator code" value={code} onChangeText={value => setCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} editable={!busy} style={{ minHeight: 52, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, color: theme.foreground, backgroundColor: theme.input, fontSize: 20, letterSpacing: 4 }} />
      <Button disabled={busy || code.length !== 6} onPress={() => void verify()}>{busy ? "Verifying…" : "Verify and continue"}</Button>
    </> : <Text style={{ color: theme.foreground }}>This account needs an authentication method that is unavailable here. Use your registered recovery authenticator or contact HoopCheck support. Password reset does not bypass this protection.</Text>}
    <Button secondary disabled={busy} onPress={() => void signOut()}>Sign out and use another account</Button>
    {message ? <Text selectable accessibilityRole="alert" style={{ color: theme.foreground }}>{message}</Text> : null}
  </ScrollView>;
}
