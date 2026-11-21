"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMfaSession } from "../../../components/MfaSession";
import { supabase } from "../../../lib/supabase";
import { enrollTotp, cancelTotpEnrollment, removeTotp, verifyTotp } from "../../../lib/auth/mfa-core";
type Setup = { id: string; qr: string; secret: string };
export default function SecurityPage() {
  const security = useMfaSession();
  return security.owner ? <SecuritySettings key={security.owner} owner={security.owner} /> : <section className="hc-security-page"><h1>Account security</h1><Link href="/login">Sign in to manage security</Link></section>;
}
function SecuritySettings({ owner }: { owner: string }) {
  const security = useMfaSession(); const factors = security.state?.factors ?? []; const verified = factors.filter(factor => factor.verified && factor.type === "totp");
  const [name, setName] = useState("HoopCheck authenticator"); const [setup, setSetup] = useState<Setup | null>(null); const [showSecret, setShowSecret] = useState(false);
  const [code, setCode] = useState(""); const [remove, setRemove] = useState(""); const [verifyWith, setVerifyWith] = useState(""); const [confirmDisable, setConfirmDisable] = useState(false);
  const [busy, setBusy] = useState(false); const pending = busy || security.phase !== "ready"; const [message, setMessage] = useState(""); const active = useRef(true); const working = useRef(false);
  useEffect(() => {
    active.current = true;
    const clear = () => { if (document.visibilityState !== "visible") { setCode(""); setShowSecret(false); setSetup(current => current ? { ...current, qr: "", secret: "" } : null); } };
    document.addEventListener("visibilitychange", clear);
    return () => { active.current = false; document.removeEventListener("visibilitychange", clear); };
  }, []);
  async function action(kind: "enroll" | "verify" | "cancel" | "remove", factorId = "") {
    if (working.current || security.phase !== "ready") return; working.current = true; setBusy(true); setMessage(""); const input = code; setCode("");
    try {
      if (kind === "enroll") { const result = await enrollTotp(supabase, owner, name); if (active.current) { setSetup(result); setShowSecret(false); } }
      if (kind === "verify" && setup) { await verifyTotp(supabase, owner, setup.id, input); if (active.current) { setSetup(null); setShowSecret(false); setMessage("Authenticator enabled. Add a backup on another device for recovery."); } security.retry(); }
      if (kind === "cancel") { await cancelTotpEnrollment(supabase, owner, factorId || setup?.id || ""); if (active.current) { setSetup(null); setShowSecret(false); setMessage("Incomplete setup cancelled."); } security.retry(); }
      if (kind === "remove") { await removeTotp(supabase, owner, remove, verifyWith, input, confirmDisable); if (active.current) { setRemove(""); setConfirmDisable(false); setMessage("Authenticator removed. Security settings refreshed."); } security.retry(); }
    } catch (error) { if (active.current) setMessage(error instanceof Error ? error.message : "Security change could not be confirmed. Refresh before trying again."); }
    finally { if (active.current) { working.current = false; setBusy(false); } }
  }
  const codeInput = <><label htmlFor="security-code">Six-digit authenticator code</label><input id="security-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={pending} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></>;
  return <section className="hc-security-page"><Link href="/account">Back to account</Link><h1>Two-factor authentication</h1>
    <p>Protect password and Google sign-ins with an authenticator app. Register a backup authenticator on another device for recovery. Password reset does not bypass this protection.</p>
    <p>{verified.length ? `${verified.length} verified authenticator${verified.length === 1 ? "" : "s"}` : "No authenticator enabled"}</p>
    {!setup && !remove ? <div className="hc-security-actions"><label htmlFor="security-device-name">Authenticator device name</label><input id="security-device-name" value={name} maxLength={50} disabled={pending} onChange={event => setName(event.target.value)} /><button className="btn" disabled={pending || !name.trim()} onClick={() => void action("enroll")}>{verified.length ? "Add backup authenticator" : "Set up authenticator"}</button><p>Use a different device name for each authenticator.</p></div> : null}
    {setup ? <div className="hc-security-actions">{setup.qr ? <><p>Scan this QR code with your authenticator, then enter a current code.</p>{/* Auth supplies the data-image URI; never render untrusted SVG markup. */}
      <Image unoptimized className="hc-security-qr" src={setup.qr} width={220} height={220} alt="Authenticator setup QR code" /><button className="btn btn-secondary" disabled={pending} onClick={() => setShowSecret(value => !value)}>{showSecret ? "Hide setup key" : "Show setup key"}</button>{showSecret ? <code>{setup.secret}</code> : null}{codeInput}<button className="btn" disabled={pending || code.length !== 6} onClick={() => void action("verify")}>Verify and enable authenticator</button></> : <p>The setup key was cleared when this page left the foreground. Cancel incomplete setup and start again.</p>}<button className="btn btn-secondary" disabled={pending} onClick={() => void action("cancel")}>Cancel incomplete setup</button></div> : null}
    {!setup && !remove ? factors.map(factor => <div className="hc-security-factor" key={factor.id}><strong>{factor.name}</strong><p>{factor.verified ? "Verified" : "Setup incomplete"}</p>{factor.type === "totp" ? <button className="btn btn-secondary" disabled={pending} onClick={() => { if (factor.verified) { setRemove(factor.id); setCode(""); setVerifyWith(verified[0]?.id ?? ""); } else void action("cancel", factor.id); }}>{factor.verified ? `Remove ${factor.name}` : `Cancel setup for ${factor.name}`}</button> : <p>Keep this verification method until it can be managed securely.</p>}</div>) : null}
    {remove ? <div className="hc-security-actions"><p>Verify using a current code from a registered authenticator before removing this device.</p><label htmlFor="security-verify-with">Verify removal with</label><select id="security-verify-with" disabled={pending} value={verifyWith} onChange={event => { setVerifyWith(event.target.value); setCode(""); }}>{verified.map(factor => <option key={factor.id} value={factor.id}>{factor.name}</option>)}</select>{codeInput}{factors.filter(factor => factor.verified).length === 1 ? <label><input type="checkbox" checked={confirmDisable} disabled={pending} onChange={event => setConfirmDisable(event.target.checked)} /> I understand this disables two-factor protection.</label> : null}<button className="btn" disabled={pending || code.length !== 6} onClick={() => void action("remove")}>Verify and remove authenticator</button><button className="btn btn-secondary" disabled={pending} onClick={() => { setRemove(""); setCode(""); setConfirmDisable(false); }}>Keep authenticator</button></div> : null}
    <button className="btn btn-secondary" disabled={pending} onClick={() => { setSetup(null); setShowSecret(false); setCode(""); security.retry(); }}>Refresh security settings</button>{busy ? <p>Confirming security change…</p> : null}{message ? <p role="status">{message}</p> : null}
  </section>;
}
