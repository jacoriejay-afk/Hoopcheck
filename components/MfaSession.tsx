"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuthState } from "./AuthProvider";
import { supabase } from "../lib/supabase";
import { readMfaState, verifyTotp, type MfaState } from "../lib/auth/mfa-core";

type Snapshot = { owner: string | null; phase: "loading" | "ready" | "challenge" | "error"; state: MfaState | null };
const initial: Snapshot = { owner: null, phase: "ready", state: null };
const Context = createContext({ ...initial, retry: () => {} });
export const useMfaSession = () => useContext(Context);
export default function MfaSession({ children }: { children: ReactNode }) {
  const { userId } = useAuthState(); const [snapshot, setSnapshot] = useState(initial); const [revision, setRevision] = useState(0);
  const retry = useCallback(() => { setSnapshot({ owner: userId, phase: "loading", state: null }); setRevision(value => value + 1); }, [userId]);
  useEffect(() => {
    // Never await Auth methods from inside its state-change callback.
    const { data } = supabase.auth.onAuthStateChange(() => retry());
    const focus = () => { if (document.visibilityState === "visible") retry(); };
    document.addEventListener("visibilitychange", focus);
    return () => { data.subscription.unsubscribe(); document.removeEventListener("visibilitychange", focus); };
  }, [retry]);
  useEffect(() => {
    let active = true;
    if (!userId) { setSnapshot(initial); return; }
    setSnapshot({ owner: userId, phase: "loading", state: null });
    void readMfaState(supabase, userId).then(state => { if (active) setSnapshot({ owner: userId, phase: state.required ? "challenge" : "ready", state }); }).catch(() => { if (active) setSnapshot({ owner: userId, phase: "error", state: null }); });
    return () => { active = false; };
  }, [userId, revision]);
  const current = snapshot.owner === userId ? snapshot : { owner: userId, phase: "loading" as const, state: null };
  const blocked = !!userId && current.phase !== "ready";
  return <Context.Provider value={{ ...current, retry }}>
    <div inert={blocked} hidden={blocked} key={userId ?? "signed-out"}>{children}</div>
    {blocked ? <section className="hc-mfa-gate" aria-labelledby="mfa-gate-title">
      {current.phase === "challenge" && current.state ? <Challenge key={userId} state={current.state} retry={retry} /> : <>
        <h1 id="mfa-gate-title">{current.phase === "error" ? "Security verification needs attention" : "Verifying your security settings…"}</h1>
        <p>{current.phase === "error" ? "Reconnect and try again, or return to normal sign-in. Your account remains protected." : "Please wait while we verify this session."}</p>
        {current.phase === "error" ? <button className="btn" onClick={retry}>Try again</button> : null}<SignOut />
      </>}
    </section> : null}
  </Context.Provider>;
}
function SignOut() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <><button className="btn btn-secondary" disabled={busy} onClick={() => { setBusy(true); void supabase.auth.signOut({ scope: "local" }).then(result => { if (result.error) throw result.error; }).catch(() => setError("Sign-out could not be confirmed. Try again.")).finally(() => setBusy(false)); }}>Sign out and use another account</button>{error ? <p role="alert">{error}</p> : null}</>;
}
function Challenge({ state, retry }: { state: MfaState; retry: () => void }) {
  const factors = state.factors.filter(factor => factor.verified && factor.type === "totp"); const [selected, setSelected] = useState(factors[0]?.id ?? "");
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const active = useRef(true);
  useEffect(() => { active.current = true; const clear = () => { if (document.visibilityState !== "visible") setCode(""); }; document.addEventListener("visibilitychange", clear); return () => { active.current = false; document.removeEventListener("visibilitychange", clear); }; }, []);
  async function verify(event: React.FormEvent) {
    event.preventDefault(); if (busy || !/^\d{6}$/.test(code)) return;
    const input = code; setCode(""); setBusy(true); setError("");
    try { await verifyTotp(supabase, state.owner, selected, input); if (active.current) retry(); }
    catch { if (active.current) setError("The code was not accepted. Use a fresh code and try again."); }
    finally { if (active.current) setBusy(false); }
  }
  return <><h1 id="mfa-gate-title">Verify your authenticator</h1><p>Enter a current code to finish signing in. You can use a registered backup authenticator if your primary device is unavailable.</p>
    {factors.length ? <form onSubmit={event => void verify(event)}><label htmlFor="mfa-factor">Authenticator</label><select id="mfa-factor" value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setCode(""); }}>{factors.map(factor => <option key={factor.id} value={factor.id}>{factor.name}</option>)}</select><label htmlFor="mfa-code">Six-digit authenticator code</label><input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /><button className="btn" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify and continue"}</button></form> : <p>This verification method is unavailable here. Use a registered backup authenticator or contact HoopCheck support. Password reset does not bypass two-factor protection.</p>}
    {error ? <p role="alert">{error}</p> : null}<SignOut /></>;
}
