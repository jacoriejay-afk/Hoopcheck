"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthPasswordField from "../../components/AuthPasswordField";
import GoogleSignInButton from "../../components/GoogleSignInButton";
import { googleAuthMessage } from "../../lib/google-auth";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const emailInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsSuccess, setMessageIsSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const candidate = query.get("returnTo") || "";
    if (query.has("google_error")) setMessage(googleAuthMessage(query.get("google_error")));
    if (candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\\\") && !candidate.includes("\\") && !candidate.startsWith("/login")) setReturnTo(candidate);
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || resetLoading) return;
    setLoading(true);
    setMessage("");
    setMessageIsSuccess(false);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      // A stalled auth request must never leave the submit button spinning forever.
      // Redirect only after Supabase confirms an authenticated user.
      const authResult = await Promise.race([
        supabase.auth.signInWithPassword({ email: normalizedEmail, password }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("Login is taking too long. Please check your connection and try again.")), 15000);
        }),
      ]);
      if (authResult.error) throw authResult.error;
      if (!authResult.data.user || !authResult.data.session) {
        throw new Error("Login could not be completed. Please try again.");
      }

      // Account type and onboarding requirements are handled by the workspace.
      // Do not block a successful login on a separate profiles query or
      // apply player-only fields to fans, coaches, agents and club managers.
      const destination = returnTo || "/dashboard";
      setMessage("Login successful! Opening HoopCheck…");
      setMessageIsSuccess(true);
      // Keep the authenticated Supabase client alive across navigation. A full
      // document reload can force Safari to rehydrate auth cookies before the
      // dashboard sees the freshly authenticated session.
      router.replace(destination);
    } catch (error) {
      console.error("Login failed:", error);
      setMessage(error instanceof Error ? error.message : "Unable to sign in right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    const normalizedEmail = email.trim().toLowerCase();
    setMessageIsSuccess(false);

    if (!normalizedEmail) {
      setMessage("Enter your email address first, then select Forgot password.");
      emailInput.current?.focus();
      return;
    }
    if (!emailInput.current?.reportValidity()) return;
    if (resetLoading) return;

    setResetLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: "https://hoopcheck.online/reset-password",
      });
      if (error) throw error;
      setMessageIsSuccess(true);
      setMessage("If an account exists for that email, we sent a password reset link.");
    } catch (error) {
      console.error("Password reset request failed:", error);
      setMessage(error instanceof Error ? error.message : "Unable to send a reset link right now. Please try again.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className="hc-auth-page">
      <section className="hc-auth-form-section" aria-labelledby="sign-in-title">
        <div className="hc-auth-card hc-sign-in-card">
          <h1 id="sign-in-title">Sign in</h1>

          <form onSubmit={handleLogin}>
            <label htmlFor="email">Email</label>
            <input ref={emailInput} id="email" className="input" type="email" value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com" autoComplete="email" required />

            <label htmlFor="password">Password</label>
            <AuthPasswordField id="password" className="input" value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password" autoComplete="current-password" required />

            <button type="button" onClick={handlePasswordReset} disabled={loading || resetLoading} className="hc-auth-action hc-reset-link">
              {resetLoading ? "Sending reset link…" : "Forgot password?"}
            </button>

            <button type="submit" className="btn hc-auth-submit" disabled={loading || resetLoading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {message && <p className="hc-auth-feedback" role={messageIsSuccess ? "status" : "alert"}>{message}</p>}

          <div className="hc-auth-divider">or</div>
          <GoogleSignInButton disabled={loading || resetLoading} />

          <p className="hc-auth-footer">
            Don&apos;t have a HoopCheck account?{" "}
            <Link href="/signup" className="hc-auth-action">Create one</Link>
          </p>
        </div>
      </section>

    </main>
  );
}
