"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthPasswordField from "../../components/AuthPasswordField";
import { stringFromBase64URL } from "@supabase/ssr";
import { consumeInitialRecoveryCode, hasRecoveryCodeVerifier, supabase } from "../../lib/supabase";

const invalidLinkMessage = "This recovery link is invalid, expired, or already used. Request a fresh password reset email.";

function sessionId(accessToken?: string) {
  try {
    const payload = accessToken?.split(".")[1];
    const id: unknown = payload && JSON.parse(stringFromBase64URL(payload)).session_id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

async function verifyRecoveryLink() {
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const invalid = [url.searchParams, fragment].some(params =>
    ["error", "error_code", "error_description"].some(key => params.has(key))
  );

  const initialRecoveryCode = consumeInitialRecoveryCode();
  try {
    if (invalid) return null;
    const recoveryCode = hasRecoveryCodeVerifier() ? url.searchParams.get("code") : null;
    const { error } = await supabase.auth.initialize();
    if (error) return null;
    const code = new URL(window.location.href).searchParams.get("code");
    if (initialRecoveryCode && !code) {
      const { data } = await supabase.auth.getSession();
      return sessionId(data.session?.access_token);
    }
    if (code && code === recoveryCode) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      return error ? null : sessionId(data.session?.access_token);
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
  const [confirmLink, setConfirmLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const recoveryToken = useRef<string | null>(null);
  const verification = useRef<ReturnType<typeof verifyRecoveryLink> | null>(null);
  const recoverySession = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token_hash");
    const hasError = ["error", "error_code", "error_description"].some(key => url.searchParams.has(key));
    if (token && url.searchParams.get("type") === "recovery" && !hasError) {
      recoveryToken.current = token;
      window.history.replaceState(window.history.state, "", url.pathname);
    }
    if (recoveryToken.current) {
      setConfirmLink(true);
      setChecking(false);
      return;
    }
    const hadLink = Boolean(url.search || url.hash);
    verification.current ??= verifyRecoveryLink();
    void verification.current.then(id => {
      if (!active) return;
      recoverySession.current = id;
      setReady(Boolean(id));
      if (!id && hadLink) setError(invalidLinkMessage);
    }).catch(() => {
      if (active) setError(invalidLinkMessage);
    }).finally(() => {
      if (active) setChecking(false);
    });

    return () => { active = false; };
  }, []);

  async function confirmRecoveryLink() {
    const token = recoveryToken.current;
    if (!token) return;
    recoveryToken.current = null;
    setConfirmLink(false);
    setChecking(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: "recovery" });
      const id = error ? null : sessionId(data.session?.access_token);
      if (!id) throw new Error(invalidLinkMessage);
      recoverySession.current = id;
      setReady(true);
    } catch {
      setError(invalidLinkMessage);
    } finally {
      setChecking(false);
    }
  }

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
      if (sessionError || !data.session || sessionId(data.session.access_token) !== recoverySession.current) {
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
    <main className="hc-auth-page">
      <section className="hc-auth-form-section" aria-labelledby="reset-title">
        <div className="hc-auth-card">
          <h1 id="reset-title">Reset your password</h1>
          {checking ? (
            <p role="status">Verifying your password reset link…</p>
          ) : confirmLink ? (
            <button type="button" className="btn hc-auth-submit" onClick={confirmRecoveryLink}>
              Continue to reset password
            </button>
          ) : ready ? (
            <form onSubmit={updatePassword}>
              <label htmlFor="password">New password</label>
              <AuthPasswordField id="password" className="input" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
              <label htmlFor="confirm-password">Confirm new password</label>
              <AuthPasswordField id="confirm-password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required />
              <button className="btn hc-auth-submit" type="submit" disabled={loading}>{loading ? "Updating…" : "Update Password"}</button>
            </form>
          ) : !message && !error ? (
            <>
              <h2>Reset link required</h2>
              <p className="muted">Request a fresh reset email from the sign-in page, then open its link.</p>
            </>
          ) : null}
          {error && <p className="hc-auth-feedback" role="alert">{error}</p>}
          {message && <p className="hc-auth-feedback" role="status">{message}</p>}
          {!ready && !checking && <Link href="/login" className="hc-auth-action">Back to sign in</Link>}
        </div>
      </section>
    </main>
  );
}
