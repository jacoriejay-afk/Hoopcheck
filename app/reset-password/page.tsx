"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else {
      setMessage("Password updated successfully. You can now use your new password.");
      setPassword("");
      setConfirm("");
    }
    setLoading(false);
  }

  return (
    <main>
      <nav className="nav">
        <Link href="/" className="logo">Hoop<span>Check</span></Link>
        <div className="links"><Link href="/login">Log In</Link></div>
      </nav>
      <section className="hero" style={{ paddingBottom: "30px" }}>
        <div className="eyebrow">ACCOUNT SECURITY</div>
        <h1>Reset your password.</h1>
        <p>Choose a new password for your HoopCheck account.</p>
      </section>
      <section style={{ maxWidth: "520px", margin: "0 auto", padding: "20px 6% 100px" }}>
        <div className="form">
          {!ready ? (
            <>
              <h2>Reset link required</h2>
              <p className="muted">Open the password reset link sent to your email to continue.</p>
              <Link href="/login" className="btn">Back to Login</Link>
            </>
          ) : (
            <form onSubmit={updatePassword}>
              <label htmlFor="password">New password</label>
              <input id="password" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
              <label htmlFor="confirm">Confirm new password</label>
              <input id="confirm" className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
              {error && <p role="alert" style={{ color: "var(--orange)" }}>{error}</p>}
              {message && <p role="status" style={{ color: "var(--orange)" }}>{message}</p>}
              <button className="btn" type="submit" disabled={loading}>{loading ? "Updating..." : "Update Password"}</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
