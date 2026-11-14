"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "PASSWORD_RECOVERY") {
        setReady(true);
        setError("");
        setChecking(false);
      }
    });

    async function verifyRecovery() {
      const query = new URLSearchParams(window.location.search);
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const failure = query.get("error_description") || fragment.get("error_description");
      if (failure) {
        if (active) setError("This recovery link is invalid or expired. Request a new password reset email.");
        if (active) setChecking(false);
        return;
      }
      try {
        // Supabase's default email template can deliver a PKCE code, a token
        // hash, or implicit-flow tokens. Never accept an unrelated signed-in
        // session as authorization to reset a password.
        const code = query.get("code");
        const tokenHash = query.get("token_hash");
        const type = query.get("type") || fragment.get("type");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (tokenHash && type === "recovery") {
          const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (verifyError) throw verifyError;
        } else if (fragment.get("access_token") && fragment.get("refresh_token") && type === "recovery") {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: fragment.get("access_token")!,
            refresh_token: fragment.get("refresh_token")!,
          });
          if (sessionError) throw sessionError;
        } else {
          if (active) setError("Open the latest password reset link from your email to continue.");
          return;
        }
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error("Recovery session was not established.");
        if (active) {
          setReady(true);
          setError("");
          window.history.replaceState(null, "", "/reset-password");
        }
      } catch {
        if (active) setError("This recovery link is invalid or expired. Request a fresh password reset email.");
      } finally {
        if (active) setChecking(false);
      }
    }

    void verifyRecovery();
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || loading) return;
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Password updated successfully. You can now sign in with your new password.");
      setPassword("");
      setConfirm("");
      setReady(false);
      await supabase.auth.signOut({ scope: "local" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update your password. Please request a new link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="hero" style={{ paddingBottom: "30px" }}>
        <div className="eyebrow">ACCOUNT SECURITY</div>
        <h1>Reset your password.</h1>
        <p>Choose a new password for your HoopCheck account.</p>
      </section>
      <section style={{ maxWidth: "520px", margin: "0 auto", padding: "20px 6% 100px" }}>
        <div className="form">
          {checking ? (
            <p role="status">Verifying your password reset link…</p>
          ) : ready ? (
            <form onSubmit={updatePassword}>
              <label htmlFor="password">New password</label>
              <input id="password" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
              <label htmlFor="confirm">Confirm new password</label>
              <input id="confirm" className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required />
              <button className="btn" type="submit" disabled={loading}>{loading ? "Updating…" : "Update Password"}</button>
            </form>
          ) : !message ? (
            <>
              <h2>Reset link required</h2>
              <p className="muted">Request a fresh reset email from the sign-in page, then open its link.</p>
            </>
          ) : null}
          {error && <p role="alert">{error}</p>}
          {message && <p role="status">{message}</p>}
          {!ready && !checking && <Link href="/login" className="btn">Back to Login</Link>}
        </div>
      </section>
    </main>
  );
}
