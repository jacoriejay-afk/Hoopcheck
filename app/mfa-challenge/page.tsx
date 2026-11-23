"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function MfaChallengePage() {
  const router = useRouter();
  const [factorId,setFactorId] = useState("");
  const [code,setCode] = useState("");
  const [message,setMessage] = useState("Checking your authentication requirements…");
  const [busy,setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const {data: user} = await supabase.auth.getUser();
      if (!active) return;
      if (!user.user) { router.replace("/login"); return; }
      const {data: level,error: levelError} = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active) return;
      if (levelError) {setMessage(levelError.message);return;}
      if (level.currentLevel === "aal2") {router.replace("/dashboard");return;}
      if (level.nextLevel !== "aal2") {router.replace("/dashboard");return;}
      const {data,error} = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (error) {setMessage(error.message);return;}
      const factor = data.totp.find(f => f.status === "verified");
      if (!factor) {setMessage("No verified authenticator found. Contact support.");return;}
      setFactorId(factor.id);setMessage("Enter the six-digit code from your authenticator app.");
    })();
    return () => {active=false;};
  },[router]);
  async function verify(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    try {
      const {data: challenge,error: challengeError} = await supabase.auth.mfa.challenge({factorId});
      if (challengeError) throw challengeError;
      const {error} = await supabase.auth.mfa.verify({factorId,challengeId:challenge.id,code});
      if (error) throw error;
      const {data: assurance,error: assuranceError} = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance.currentLevel !== "aal2") throw new Error("Second-factor verification not confirmed.");
      router.replace("/dashboard");
    } catch(e) {setMessage(e instanceof Error ? e.message : "Verification failed.");}
    finally {setBusy(false);}
  }
  return <main className="hc-auth-page"><section className="form hc-auth-card" style={{maxWidth:480,margin:"32px auto",padding:24}}>
    <h1>Verify your sign-in</h1><p role="status" aria-live="polite">{message}</p>
    <form onSubmit={verify}><label htmlFor="mfa-code">Authenticator code</label>
      <input id="mfa-code" className="input" autoComplete="one-time-code" inputMode="numeric" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/>
      <button type="submit" className="btn" disabled={busy || !factorId || code.length !== 6}>{busy ? "Verifying…" : "Verify code"}</button>
    </form>
    <button type="button" className="btn dark" onClick={async()=>{await supabase.auth.signOut();router.replace("/login");}}>Sign out</button>
  </section></main>;
}
