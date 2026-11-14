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
        setChecking(false);
      }
    });

    async function processLink() {
      const url = new URL(window.location.href);
      const tokenHash = url.searchParams.get("token_hash");
      const code = url.searchParams.get("code");
      const linkError = url.searchParams.get("error_description") || url.searchParams.get("error");
      const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
      const fragmentError = fragment.get("error_description") || fragment.get("error");
      try {
        if (linkError || fragmentError) throw new Error(linkError || fragmentError || "Invalid recovery link.");
        if (tokenHash) {
          const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (result.error) throw result.error;
          if (active) setReady(true);
        } else if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);
          if (result.error) throw result.error;
          if (active) setReady(true);
        } else if (fragment.get("type") === "recovery" && fragment.get("access_token")) {
          // Supabase's browser client processes implicit recovery fragments.
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (active && data.session) setReady(true);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "This reset link is invalid or expired.");
      } finally {
        if (active) {
          setChecking(false);
          if (tokenHash || code || fragment.has("access_token")) {
            window.history.replaceState(null, "", url.pathname);
          }
        }
      }
    }
    void processLink();
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Password updated. You can now sign in with your new password.");
      setReady(false);
      setPassword("");
      setConfirm("");
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.");
    } finally { setLoading(false); }
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
          {checking ? <p role="status">Checking your reset link…</p> : ready ? (
            <form onSubmit={updatePassword}>
              <label htmlFor="password">New password</label>
              <input id="password" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
              <label htmlFor="confirm">Confirm new password</label>
              <input id="confirm" className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required minLength={8} />
              {error && <p role="alert" style={{ color: "var(--orange)" }}>{error}</p>}
              <button className="btn" type="submit" disabled={loading}>{loading ? "Updating…" : "Update Password"}</button>
            </form>
          ) : (
            <>
              <h2>{message ? "Password updated" : "Reset link required"}</h2>
              <p className="muted">{message || error || "This link is missing, expired, or has already been used. Request a fresh reset email from Sign In."}</p>
              <Link href="/login" className="btn">{message ? "Sign In" : "Back to Login"}</Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
