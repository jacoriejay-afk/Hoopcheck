import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { Button, GlassCard } from "../../src/primitives";
import { useEntryTheme } from "../../src/theme";
import { useMfaSession } from "../../src/native/mfa";
import { supabase } from "../../src/lib/supabase";
import { enrollTotp, cancelTotpEnrollment, removeTotp, verifyTotp } from "../../../../lib/auth/mfa-core";
type Setup = { id: string; qr: string; secret: string };
export default function AccountSecurityScreen() {
  const security = useMfaSession();
  return security.owner ? <SecuritySettings key={security.owner} owner={security.owner} /> : <Text style={{ padding: 24 }}>Verifying security settings…</Text>;
}
function SecuritySettings({ owner }: { owner: string }) {
  const theme = useEntryTheme(); const security = useMfaSession(); const factors = security.state?.factors ?? []; const verified = factors.filter(factor => factor.verified && factor.type === "totp");
  const [name, setName] = useState("HoopCheck authenticator"); const [setup, setSetup] = useState<Setup | null>(null); const [showSecret, setShowSecret] = useState(false);
  const [code, setCode] = useState(""); const [remove, setRemove] = useState(""); const [verifyWith, setVerifyWith] = useState(verified[0]?.id ?? ""); const [confirmDisable, setConfirmDisable] = useState(false);
  const [busy, setBusy] = useState(false); const pending = busy || security.phase !== "ready"; const [message, setMessage] = useState(""); const active = useRef(true); const working = useRef(false); const visibilityEpoch = useRef(0);
  useEffect(() => {
    active.current = true;
    const listener = AppState.addEventListener("change", state => { if (state !== "active") { visibilityEpoch.current++; setCode(""); setShowSecret(false); setSetup(current => current ? { ...current, qr: "", secret: "" } : null); } });
    return () => { active.current = false; listener.remove(); };
  }, []);
  async function action(kind: "enroll" | "verify" | "cancel" | "remove", factorId = "") {
    if (working.current || security.phase !== "ready") return; working.current = true; setBusy(true); setMessage(""); const input = code; const enrollmentEpoch = visibilityEpoch.current; setCode("");
    try {
      if (kind === "enroll") { const result = await enrollTotp(supabase, owner, name); if (active.current) { setSetup(visibilityEpoch.current === enrollmentEpoch && AppState.currentState === "active" ? result : { id: result.id, qr: "", secret: "" }); setShowSecret(false); } }
      if (kind === "verify" && setup) { await verifyTotp(supabase, owner, setup.id, input); if (active.current) { setSetup(null); setShowSecret(false); setMessage("Authenticator enabled. Add a backup on another device for recovery."); } security.retry(); }
      if (kind === "cancel") { await cancelTotpEnrollment(supabase, owner, factorId || setup?.id || ""); if (active.current) { setSetup(null); setShowSecret(false); setMessage("Incomplete setup cancelled."); } security.retry(); }
      if (kind === "remove") { await removeTotp(supabase, owner, remove, verifyWith, input, confirmDisable); if (active.current) { setRemove(""); setConfirmDisable(false); setMessage("Authenticator removed. Security settings refreshed."); } security.retry(); }
    } catch (error) { if (active.current) setMessage(error instanceof Error ? error.message : "Security change could not be confirmed. Refresh before trying again."); }
    finally { if (active.current) { working.current = false; setBusy(false); } }
  }
  let svg = setup?.qr.slice(setup.qr.indexOf(",") + 1) ?? "";
  try { svg = decodeURIComponent(svg); } catch { /* Auth's SVG may already contain raw percent characters. */ }
  const codeInput = <TextInput accessibilityLabel="Six-digit authenticator code" value={code} onChangeText={value => setCode(value.replace(/\D/g, "").slice(0, 6))} maxLength={6} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" editable={!pending} style={{ minHeight: 52, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 12, color: theme.foreground, backgroundColor: theme.input, fontSize: 20, letterSpacing: 4 }} />;
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 26, fontWeight: "900" }}>Two-factor authentication</Text>
    <Text style={{ color: theme.muted }}>Use an authenticator app to protect password and Google sign-ins. A registered backup authenticator on a different device provides recovery; password reset does not bypass this protection.</Text>
    <GlassCard><Text style={{ color: theme.foreground }}>{verified.length ? `${verified.length} verified authenticator${verified.length === 1 ? "" : "s"}` : "No authenticator enabled"}</Text></GlassCard>
    {!setup && !remove ? <><TextInput accessibilityLabel="Authenticator device name" value={name} onChangeText={setName} maxLength={50} editable={!pending} style={{ minHeight: 48, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 12, color: theme.foreground, backgroundColor: theme.input }} /><Button disabled={pending || !name.trim()} onPress={() => void action("enroll")}>{verified.length ? "Add backup authenticator" : "Set up authenticator"}</Button><Text style={{ color: theme.muted }}>Use a different device name for each authenticator.</Text></> : null}
    {setup ? <View style={{ gap: 12 }}>
      {setup.qr ? <><Text style={{ color: theme.foreground }}>Scan this QR code with your authenticator, then enter a current six-digit code.</Text><SvgXml xml={svg} width={220} height={220} style={{ alignSelf: "center", backgroundColor: theme.qrSurface }} accessibilityLabel="Authenticator setup QR code" /><Button secondary disabled={pending} onPress={() => setShowSecret(value => !value)}>{showSecret ? "Hide setup key" : "Show setup key"}</Button>{showSecret ? <Text selectable style={{ color: theme.foreground }}>{setup.secret}</Text> : null}{codeInput}<Button disabled={pending || code.length !== 6} onPress={() => void action("verify")}>Verify and enable authenticator</Button></> : <Text style={{ color: theme.foreground }}>The setup key was cleared when the app left the foreground. Cancel this incomplete setup and start again.</Text>}
      <Button secondary disabled={pending} onPress={() => void action("cancel")}>Cancel incomplete setup</Button>
    </View> : null}
    {!setup && !remove ? factors.map(factor => <GlassCard key={factor.id}><Text style={{ color: theme.foreground, fontWeight: "700" }}>{factor.name}</Text><Text style={{ color: theme.muted }}>{factor.verified ? "Verified" : "Setup incomplete"}</Text>{factor.type === "totp" ? <Button secondary disabled={pending} onPress={() => { if (factor.verified) { setRemove(factor.id); setCode(""); setVerifyWith(verified[0]?.id ?? ""); } else void action("cancel", factor.id); }}>{factor.verified ? `Remove ${factor.name}` : `Cancel setup for ${factor.name}`}</Button> : <Text style={{ color: theme.muted }}>Keep this verification method until it can be managed securely.</Text>}</GlassCard>) : null}
    {remove ? <View style={{ gap: 12 }}><Text style={{ color: theme.foreground }}>Verify using a current code from a registered authenticator before removing this device.</Text><View accessibilityRole="radiogroup" accessibilityLabel="Verify removal with" style={{ gap: 8 }}>{verified.map(factor => <Pressable key={factor.id} accessibilityRole="radio" accessibilityLabel={factor.name} accessibilityState={{ checked: verifyWith === factor.id }} disabled={pending} onPress={() => { setVerifyWith(factor.id); setCode(""); }} style={{ minHeight: 48, padding: 12, borderWidth: 1, borderColor: verifyWith === factor.id ? theme.accent : theme.border, borderRadius: 12 }}><Text style={{ color: theme.foreground }}>{factor.name}</Text></Pressable>)}</View>{codeInput}{factors.filter(factor => factor.verified).length === 1 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Text style={{ flex: 1, color: theme.foreground }}>I understand this disables two-factor protection.</Text><Switch accessibilityLabel="Confirm disabling two-factor protection" value={confirmDisable} onValueChange={setConfirmDisable} disabled={pending} /></View> : null}<Button disabled={pending || code.length !== 6} onPress={() => void action("remove")}>Verify and remove authenticator</Button><Button secondary disabled={pending} onPress={() => { setRemove(""); setCode(""); setConfirmDisable(false); }}>Keep authenticator</Button></View> : null}
    <Button secondary disabled={pending} onPress={() => { setSetup(null); setShowSecret(false); setCode(""); security.retry(); }}>Refresh security settings</Button>
    {busy ? <Text style={{ color: theme.muted }}>Confirming security change…</Text> : null}{message ? <Text selectable accessibilityRole="alert" style={{ color: theme.foreground }}>{message}</Text> : null}
  </ScrollView></SafeAreaView>;
}
