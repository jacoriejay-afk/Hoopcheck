"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "../../components/Logo";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [status, setStatus] = useState("");
  const [statusIsSuccess, setStatusIsSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState("");

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get("returnTo") || "";
    if (
      candidate.startsWith("/") &&
      !candidate.startsWith("//") &&
      !candidate.includes("\\") &&
      !candidate.startsWith("/login")
    ) {
      setReturnTo(candidate);
    }
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setEmailError("");
    setPasswordError("");
    setStatus("");
    setStatusIsSuccess(false);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setEmailError("Enter your email address.");
      return;
    }
    if (!password) {
      setPasswordError("Enter your password.");
      return;
    }

    setLoading(true);
    let timeoutId: number | undefined;
    try {
      const authResult = await Promise.race([
        supabase.auth.signInWithPassword({ email: normalizedEmail, password }),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error("Login is taking too long. Please check your connection and try again.")),
            15000,
          );
        }),
      ]);
      if (authResult.error) throw authResult.error;
      if (!authResult.data.user || !authResult.data.session) {
        throw new Error("Login could not be completed. Please try again.");
      }

      setStatus("Signed in. Opening your HoopCheck workspace…");
      setStatusIsSuccess(true);
      router.replace(returnTo || "/dashboard");
    } catch (error) {
      console.error("Login failed:", error);
      const message = error instanceof Error ? error.message : "Unable to sign in right now. Please try again.";
      if (/email|user not found/i.test(message)) {
        setEmailError(message);
      } else if (/password|credentials|invalid login/i.test(message)) {
        setPasswordError("Email or password is incorrect. Please try again.");
      } else {
        setStatus(message);
      }
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    const normalizedEmail = email.trim().toLowerCase();
    setEmailError("");
    setPasswordError("");
    setStatus("");
    setStatusIsSuccess(false);
    if (!normalizedEmail) {
      setEmailError("Enter your email address first.");
      return;
    }
    if (resetLoading) return;

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setStatus("If an account exists for that email, we sent a password reset link.");
      setStatusIsSuccess(true);
    } catch (error) {
      console.error("Password reset request failed:", error);
      setEmailError(error instanceof Error ? error.message : "Unable to send a reset link right now. Please try again.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className="hc-auth-page hc-login-page">
      <section className="hc-auth-form-section">
        <div className="form hc-auth-card hc-login-card">
          <Link href="/" className="hc-auth-logo" aria-label="HoopCheck home"><Logo variant="full" size={46} /></Link>
          <div className="eyebrow">WELCOME BACK</div>
          <h1>Sign in to HoopCheck</h1>
          <form onSubmit={handleLogin} noValidate>
            <div className="hc-login-field">
              <label htmlFor="email">EMAIL</label>
              <input
                id="email"
                className="input"
                type="email"
                value={email}
                onChange={event => { setEmail(event.target.value); setEmailError(""); }}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? "email-error" : undefined}
                required
              />
              {emailError && <p id="email-error" className="hc-login-error" role="alert">{emailError}</p>}
            </div>
            <div className="hc-login-field">
              <label htmlFor="password">PASSWORD</label>
              <div className="hc-password-control">
                <input
                  id="password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={event => { setPassword(event.target.value); setPasswordError(""); }}
                  placeholder="Your password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={passwordError ? "password-error" : undefined}
                  required
                />
                <button
                  type="button"
                  className="hc-password-toggle"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
              {passwordError && <p id="password-error" className="hc-login-error" role="alert">{passwordError}</p>}
            </div>
            <button type="submit" className="btn hc-login-submit" disabled={loading}>
              {loading ? "SIGNING IN…" : "SIGN IN"}<span aria-hidden="true">↗</span>
            </button>
          </form>
          {status && (
            <p className={statusIsSuccess ? "hc-login-status is-success" : "hc-login-status"} role="status" aria-live="polite">
              {status}
            </p>
          )}
          <button type="button" className="hc-login-forgot" onClick={handlePasswordReset} disabled={resetLoading}>
            {resetLoading ? "Sending reset link…" : "Forgot password?"}
          </button>
          <p className="hc-login-signup">New to HoopCheck? <Link href="/signup">Create your account</Link></p>
        </div>
      </section>
    </main>
  );
}
