"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Factor = { id: string; friendly_name?: string };
type Pending = { id: string; qr: string; secret: string };

export default function AccountSecurityPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [assurance, setAssurance] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [selected, setSelected] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const userId = useRef<string | null>(null);
  const operation = useRef(false);
  const generation = useRef(0);

  async function refresh() {
    const version = generation.current;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (version !== generation.current) return;
    if (userError || !user) {
      userId.current = null;
      setSignedIn(false); setReady(true); setFactors([]); setAssurance(null);
      setPending(null); setCode(""); setSelected(""); return;
    }
    userId.current = user.id;
    setSignedIn(true);
    const [list, level] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (version !== generation.current) return;
    if (list.error || level.error) {
      setMessage("Security settings could not be loaded. Refresh and try again.");
      setReady(false); return;
    }
    setFactors(list.data.totp);
    setSelected(previous => list.data.totp.some(f => f.id === previous) ? previous : list.data.totp[0]?.id ?? "");
    setAssurance(level.data.currentLevel);
    setReady(true);
  }

  useEffect(() => {
    void refresh().catch(() => setMessage("Security settings could not be loaded. Refresh and try again."));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (userId.current && session?.user.id !== userId.current)) {
        generation.current++;
        userId.current = null;
        setSignedIn(false); setReady(true); setFactors([]); setAssurance(null);
        setPending(null); setCode(""); setSelected(""); setMessage("");
      }
    });
    return () => { generation.current++; subscription.unsubscribe(); };
  }, []);

  async function run(action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true; setBusy(true); setMessage("");
    const version = generation.current;
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (version !== generation.current) return;
      if (error || !user || user.id !== userId.current) {
        setPending(null); setCode(""); setMessage("Your session changed. Sign in again to continue."); return;
      }
      await action();
    } catch {
      if (version === generation.current) setMessage("The security operation could not be completed. Please try again.");
    } finally {
      operation.current = false; setBusy(false);
    }
  }

  async function enroll() {
    await run(async () => {
      const version = generation.current;
      const result = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (version !== generation.current) return;
      if (result.error || !result.data) {
        setMessage("Could not start authenticator setup. Sign in again or try later."); return;
      }
      const qr = result.data.totp.qr_code;
      setPending({ id: result.data.id, qr: qr.startsWith("data:image/svg+xml") || qr.startsWith("data:image/png") ? qr : "", secret: result.data.totp.secret });
      setCode("");
    });
  }

  async function verify() {
    await run(async () => {
      const factorId = pending?.id ?? selected;
      if (!factorId || !/^\d{6}$/.test(code)) { setMessage("Enter the six-digit code from your authenticator."); return; }
      const version = generation.current;
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (version !== generation.current) return;
      setCode("");
      if (result.error) { setMessage("The code could not be verified. Check your authenticator and try again."); return; }
      setPending(null);
      await refresh();
      if (version === generation.current && userId.current) setMessage("Authenticator verified for this session.");
    });
  }

  async function cancelSetup() {
    await run(async () => {
      if (!pending) return;
      const version = generation.current;
      const result = await supabase.auth.mfa.unenroll({ factorId: pending.id });
      if (version !== generation.current) return;
      if (result.error) { setMessage("Could not cancel this unfinished setup. Try again."); return; }
      setPending(null); setCode(""); await refresh();
    });
  }

  return (
    <main className="hc-page" style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
      <Link href="/account">Back to account</Link>
      <h1>Account security</h1>
      <section aria-labelledby="two-factor-heading">
        <h2 id="two-factor-heading">Two-factor authentication</h2>
        {!ready ? <p>Loading security settings…</p> : !signedIn ? <p>Sign in to manage your security settings.</p> : <>
          <p>{factors.length ? "An authenticator is enrolled." : "No verified authenticator is enrolled."}</p>
          <p>{assurance === "aal2" ? "This session has completed two-factor verification." : "This session has not completed two-factor verification."}</p>
          {!pending && (factors.length === 0 || assurance === "aal2") && <>
            <p>Use an authenticator app. Enrolling and verifying a new factor can sign out other sessions. Keep a second authenticator available for recovery.</p>
            <button type="button" disabled={busy} onClick={() => void enroll()}>{factors.length ? "Add backup authenticator" : "Set up authenticator"}</button>
          </>}
          {pending && <div>
            <p>Scan this code in your authenticator app or enter the setup key manually. Never share the setup key or a verification code.</p>
            {pending.qr && <img src={pending.qr} alt="Authenticator setup QR code" width={200} height={200} referrerPolicy="no-referrer" />}
            <p>Setup key: <code style={{ overflowWrap: "anywhere" }}>{pending.secret}</code></p>
            <button type="button" disabled={busy} onClick={() => void cancelSetup()}>Cancel unfinished setup</button>
          </div>}
          {(pending || (factors.length > 0 && assurance !== "aal2")) && <form onSubmit={event => { event.preventDefault(); void verify(); }}>
            {!pending && <label>Authenticator<select value={selected} onChange={event => setSelected(event.target.value)} disabled={busy}>{factors.map((factor,index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || "Authenticator " + (index + 1)}</option>)}</select></label>}
            <label>Six-digit code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g,"").slice(0,6))} maxLength={6} required disabled={busy} /></label>
            <button type="submit" disabled={busy || code.length !== 6}>Verify authenticator</button>
          </form>}
          <p>Enrollment alone does not make two-factor authentication mandatory for every login or administrative action. That enforcement requires separate access-policy verification.</p>
        </>}
        {message && <p role="status" aria-live="polite">{message}</p>}
      </section>
    </main>
  );
}
