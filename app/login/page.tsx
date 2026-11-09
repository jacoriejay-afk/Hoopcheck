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
  const [message, setMessage] = useState("");
  const [messageIsSuccess, setMessageIsSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState("");
  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get("returnTo") || "";
    if (candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\\\") && !candidate.includes("\\") && !candidate.startsWith("/login")) setReturnTo(candidate);
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
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

    if (!normalizedEmail) {
      setMessage("Enter your email address first, then select Forgot password.");
      return;
    }
    if (resetLoading) return;

    setResetLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
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
<section className="hero hc-auth-hero" style={{ paddingBottom: "30px" }}>
        <div className="eyebrow">WELCOME BACK</div>
        <h1>Welcome back.</h1>
        <p>
          Sign in to your HoopCheck account to explore teams, coaches, leagues, player experiences, and fan communities around the world.
        </p>
      </section>

      <section className="hc-auth-form-section" style={{ maxWidth: "520px", margin: "0 auto", padding: "20px 6% 100px" }}>
        <div className="form hc-auth-card">
          <Link href="/" className="hc-auth-logo" aria-label="HoopCheck home"><Logo variant="full" size={44} /></Link>
          <div className="eyebrow">Login</div>
          <h2 style={{ fontSize: "30px", letterSpacing: "-1px", marginTop: 0 }}>
            Sign in to HoopCheck
          </h2>
          <p className="muted">
            Use the email and password associated with your account.
          </p>

          <form onSubmit={handleLogin}>
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com" autoComplete="email" required />

            <label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password" autoComplete="current-password" required />

            <button type="submit" className="btn" disabled={loading}
              style={{ width: "100%", marginTop: 8 }}>
              {loading ? "Logging In..." : "Log In"}
            </button>
          </form>

          {message && (
            <div style={{ marginTop: 18, padding: 14, border: messageIsSuccess ? "1px solid #86c7a2" : "1px solid #e5aaa6", borderRadius: 8, background: messageIsSuccess ? "#edf9f1" : "#fff1f0" }}>
              <p role={messageIsSuccess ? "status" : "alert"} aria-live="polite" style={{ margin: 0, color: messageIsSuccess ? "#17633a" : "#8c1d18", lineHeight: 1.5 }}>
                {message}
              </p>
            </div>
          )}

          <button type="button" onClick={handlePasswordReset} disabled={resetLoading}
            style={{ background: "transparent", border: 0, color: "var(--hc-accent-text)", padding: 0, marginTop: 14, cursor: resetLoading ? "default" : "pointer", fontWeight: 800 }}>
            {resetLoading ? "Sending reset link..." : "Forgot password?"}
          </button>

          <p className="muted" style={{ marginTop: 22, marginBottom: 0 }}>
            Don&apos;t have a HoopCheck account?{" "}
            <Link href="/signup" style={{ color: "var(--orange)", fontWeight: 900 }}>Create one</Link>
          </p>
        </div>
      </section>

      <section className="hc-auth-promo" style={{ maxWidth: "900px", margin: "0 auto", padding: "0 6% 100px" }}>
        <div className="card">
          <div className="eyebrow">HoopCheck</div>
          <h2>Research before<br />you commit.</h2>
          <p>Explore basketball communities and make informed decisions, whether you’re a player, fan, coach, or club representative.</p>
          <div className="actions">
            <Link href="/signup" className="btn">Create Free Account</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
