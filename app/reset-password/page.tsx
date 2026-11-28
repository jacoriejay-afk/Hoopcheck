"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthPasswordField from "../../components/AuthPasswordField";
import { stringFromBase64URL } from "@supabase/ssr";
import { takeRecoveryCodeVerifier, takeRecoveryEntry } from "../../lib/supabase";
import { recoveryLink } from "../../lib/auth/password-recovery";
import { createBrowserRecoveryClient } from "../../lib/auth/browser-recovery";

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

type RecoverySession = { owner: string; id: string };
function recoveryIdentity(session: { user: { id: string }; access_token: string } | null): RecoverySession | null {
  const id = sessionId(session?.access_token);
  return id && session?.user.id ? { owner: session.user.id, id } : null;
}

type RecoveryClient = ReturnType<typeof createBrowserRecoveryClient>;
async function verifyRecoveryCode(client: RecoveryClient, code: string) {
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  return error || !("redirectType" in data) || data.redirectType !== "PASSWORD_RECOVERY" ? null : recoveryIdentity(data.session);
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
  const verification = useRef<{ work: ReturnType<typeof verifyRecoveryCode>; hadLink: boolean } | null>(null);
  const recoverySession = useRef<RecoverySession | null>(null);
  const client = useRef<RecoveryClient | null>(null);
  const updating = useRef(false);

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const entry = takeRecoveryEntry(url.pathname);
    const hasUrlCredentials = Boolean(url.search || url.hash);
    // The initial captured entry wins if hydration restores the original URL.
    const link = entry ? entry.link : hasUrlCredentials ? recoveryLink(url.searchParams, new URLSearchParams(url.hash.slice(1))) : null;
    if (hasUrlCredentials) window.history.replaceState(window.history.state, "", url.pathname);
    if (link?.token) {
      recoveryToken.current = link.token;
    }
    if (recoveryToken.current) {
      setConfirmLink(true);
      setChecking(false);
      return;
    }
    if (!verification.current) {
      const code = url.pathname === "/reset-password" ? link?.code : undefined;
      const verifier = code ? (entry ? entry.verifier : takeRecoveryCodeVerifier()) : null;
      let work: ReturnType<typeof verifyRecoveryCode> = Promise.resolve(null);
      if (code && verifier) {
        client.current = createBrowserRecoveryClient(verifier);
        work = verifyRecoveryCode(client.current, code);
      }
      verification.current = { work, hadLink: Boolean(entry || hasUrlCredentials) };
    }
    const { work, hadLink } = verification.current;
    void work.then(id => {
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
      const recoveryClient = createBrowserRecoveryClient();
      client.current = recoveryClient;
      const { data, error } = await recoveryClient.auth.verifyOtp({ token_hash: token, type: "recovery" });
      const identity = error ? null : recoveryIdentity(data.session);
      if (!identity) throw new Error(invalidLinkMessage);
      recoverySession.current = identity;
      setReady(true);
    } catch {
      setError(invalidLinkMessage);
    } finally {
      setChecking(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const identity = recoverySession.current;
    const auth = client.current?.auth;
    if (!ready || !identity || !auth || updating.current) return;
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
    updating.current = true;
    setLoading(true);
    try {
      const change = (auth as unknown as Record<symbol, (owner: string, id: string, value: string) => Promise<{ error: unknown; signOutError?: unknown }>>)[Symbol.for("hoopcheck.recovery-password")];
      const { error: updateError, signOutError } = await change(identity.owner, identity.id, password);
      if (updateError) {
        const { data } = await auth.getSession();
        const current = recoveryIdentity(data.session);
        if (current?.id === identity.id && current.owner === identity.owner) throw updateError;
        recoverySession.current = null;
        setReady(false);
        throw new Error("Your recovery session ended. Request a fresh password reset email.");
      }
      recoverySession.current = null;
      setMessage(signOutError ? "Password changed. Sign out before signing in again." : "Password updated. Sign in with your new password.");
      setPassword("");
      setConfirm("");
      setReady(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update your password. Please request a new link.");
    } finally {
      updating.current = false;
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
          {!ready && !checking && !confirmLink && !message && <p><Link href="/login?recover=1" className="hc-auth-action">Request a new reset link</Link></p>}
          {!ready && !checking && <Link href="/login" className="hc-auth-action">Back to sign in</Link>}
        </div>
      </section>
    </main>
  );
}
