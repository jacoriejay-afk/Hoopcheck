"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { initialRecoveryLink, supabase } from "../../lib/supabase";

async function verifyRecoveryLink() {
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const invalid = [url.searchParams, fragment].some(params =>
    ["error", "error_code", "error_description"].some(key => params.has(key))
  );

  try {
    if (invalid) return null;
    const tokenHash = url.searchParams.get("token_hash");
    if (tokenHash && url.searchParams.get("type") === "recovery") {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
      return error ? null : data.session?.user.id;
    }

    // Supabase initializes its browser client from legacy PKCE and implicit links.
    // Only accept its session if initialization actually consumed the callback.
    const { error } = await supabase.auth.initialize();
    if (error) return null;
    const current = new URL(window.location.href);
    const autoConsumed = (initialRecoveryLink === "pkce" && !current.searchParams.has("code"))
      || (initialRecoveryLink === "implicit" && !current.hash);
    if (autoConsumed) {
      const { data } = await supabase.auth.getSession();
      return data.session?.user.id;
    }

    // Client-side navigation can open the page after the auth client initialized.
    const code = url.searchParams.get("code");
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      return error ? null : data.session?.user.id;
    }
    const access_token = fragment.get("access_token");
    const refresh_token = fragment.get("refresh_token");
    if (fragment.get("type") === "recovery" && access_token && refresh_token) {
      const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
      return error ? null : data.session?.user.id;
    }
    return null;
  } finally {
    if (window.location.pathname === url.pathname) {
      window.history.replaceState(window.history.state, "", url.pathname);
    }
  }
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const verification = useRef<ReturnType<typeof verifyRecoveryLink> | null>(null);
  const recoveryUser = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    verification.current ??= verifyRecoveryLink();
    void verification.current.then(userId => {
      if (!active) return;
      recoveryUser.current = userId ?? null;
      setReady(Boolean(userId));
    }).catch(() => {
      if (active) setError("This recovery link is invalid or expired. Request a fresh password reset email.");
    }).finally(() => {
      if (active) setChecking(false);
    });

    return () => { active = false; };
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
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session || data.session.user.id !== recoveryUser.current) {
        setReady(false);
        throw new Error("Your recovery session ended. Request a fresh password reset email.");
      }
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
