"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

export default function AccountSecurityPage() {
  const [status, setStatus] = useState("Loading security settings…");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);

  async function refresh() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setStatus("Sign in to manage your security."); return; }
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { setStatus(error.message); return; }
    const verified = data.totp.find(f => f.status === "verified");
    setEnabled(Boolean(verified));
    setFactorId(verified?.id ?? "");
    setStatus(verified ? "Authenticator verification is enabled." : "Authenticator verification is not enabled.");
  }
  useEffect(() => { void refresh(); }, []);

  async function enroll() {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "HoopCheck authenticator" });
      if (error) throw error;
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStatus("Scan the QR code with your authenticator app, then enter its six-digit code.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Could not start setup."); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) { setStatus("Enter a six-digit authenticator code."); return; }
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (error) throw error;
      setQr(""); setSecret(""); setCode("");
      await refresh();
    } catch (e) { setStatus(e instanceof Error ? e.message : "Verification failed."); }
    finally { setBusy(false); }
  }

  return <main className="hc-auth-page"><section className="form hc-auth-card" style={{maxWidth:520,margin:"32px auto",padding:24}}>
    <Link href="/account">← Account</Link>
    <h1>Account security</h1>
    <h2>Two-factor authentication</h2>
    <p role="status" aria-live="polite">{status}</p>
    {!enabled && !qr && <button type="button" className="btn" disabled={busy} onClick={enroll}>Set up authenticator</button>}
    {!enabled && qr && <>
      <p>Scan this QR code using an authenticator app. Keep your setup key private.</p>
      <img src={qr} alt="Authenticator setup QR code" style={{width:220,height:220,maxWidth:"100%"}} />
      <details><summary>Can't scan? Show setup key</summary><code style={{overflowWrap:"anywhere"}}>{secret}</code></details>
      <label htmlFor="totp-code">Six-digit verification code</label>
      <input id="totp-code" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} />
      <button type="button" className="btn" disabled={busy} onClick={verify}>Verify and enable</button>
    </>}
    {enabled && <p>Keep your authenticator app available for future sign-ins. Factor removal requires a verified secure session.</p>}
  </section></main>;
}
