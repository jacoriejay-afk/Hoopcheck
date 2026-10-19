"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Logo from "../../components/Logo";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) throw error;
      if (!data.user) {
        setMessage("Login could not be completed. Please try again.");
        return;
      }

      // A missing profile row or a temporary profile query failure should not
      // strand a valid user on the login screen after authentication succeeds.
      let profile: { display_name?: string | null; position?: string | null; years_pro?: number | null } | null = null;
      try {
        const result = await supabase
          .from("profiles")
          .select("display_name,position,years_pro")
          .eq("id", data.user.id)
          .maybeSingle();
        profile = result.data;
      } catch (profileError) {
        console.error("Could not load profile after login:", profileError);
      }

      const needsOnboarding =
        !profile?.display_name ||
        (!profile?.position && profile?.years_pro == null);

      window.location.replace(needsOnboarding ? "/onboarding" : "/dashboard");
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
        <div className="eyebrow">PLAYER ACCESS</div>
        <h1>Welcome back.</h1>
        <p>
          Log in to research coaches, teams, leagues, and player experiences
          around the world.
        </p>
      </section>

      <section className="hc-auth-form-section" style={{ maxWidth: "520px", margin: "0 auto", padding: "20px 6% 100px" }}>
        <div className="form hc-auth-card">
          <Link href="/" className="hc-auth-logo" aria-label="HoopCheck home"><Logo variant="full" size={44} /></Link>
          <div className="eyebrow">Player Login</div>
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
            <div style={{ marginTop: 18, padding: 14, border: "1px solid #e5aaa6", borderRadius: 8, background: "#fff1f0" }}>
              <p role="alert" aria-live="polite" style={{ margin: 0, color: "#8c1d18", lineHeight: 1.5 }}>
                {message}
              </p>
            </div>
          )}

          <button type="button" onClick={handlePasswordReset} disabled={resetLoading}
            style={{ background: "transparent", border: 0, color: "var(--orange)", padding: 0, marginTop: 14, cursor: resetLoading ? "default" : "pointer", fontWeight: 800 }}>
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
          <p>Your next overseas opportunity can change your career. Get more information before you sign.</p>
          <div className="actions">
            <Link href="/signup" className="btn">Create Free Account</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
