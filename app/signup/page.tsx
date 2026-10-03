"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const TERMS_VERSION = "2026-10-01";

export default function SignupPage() {
const router = useRouter();

const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [isAdult, setIsAdult] = useState(false);
const [agreedToTerms, setAgreedToTerms] = useState(false);

const [loading, setLoading] = useState(false);
const [message, setMessage] = useState("");
const [error, setError] = useState("");

async function handleSignup(event: FormEvent) {
event.preventDefault();

setLoading(true);
setError("");
setMessage("");
if (name.trim().length < 2) {
  setError("Please enter your name.");
  setLoading(false);
  return;
}
if (password.length < 6) {
  setError("Password must be at least 6 characters.");
  setLoading(false);
  return;
}
if (!isAdult) {
  setError("You must confirm that you are 18 or older.");
  setLoading(false);
  return;
}
if (!agreedToTerms) {
  setError(
    "Please agree to the Terms of Service and acknowledge the Privacy Policy."
  );
  setLoading(false);
  return;
}
const { data, error } = await supabase.auth.signUp({
  email: email.trim().toLowerCase(),
  password,
  options: {
    data: {
      full_name: name.trim(),
      is_adult: true,
      agreed_to_terms: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
    },
  },
});
if (error) {
  setError(error.message);
  setLoading(false);
  return;
}
if (data.session) {
  router.push("/dashboard");
  return;
}
setMessage(
  "Account created. Check your email to confirm your account before logging in."
);
setLoading(false);

}

return (
<main>
<nav className="nav">
  <Link href="/" className="logo">
    Hoop<span>Check</span>
  </Link>
    <div className="links">
      <Link href="/login">Log In</Link>
    </div>
  </nav>
  <section className="auth-page">
    <div className="auth-hero">
      <div className="eyebrow">JOIN HOOPCHECK</div>
      <h1>
        Know before
        <br />
        you commit.
      </h1>
      <p>
        Join the global basketball research platform built for players
        who want real information before making their next career
        decision.
      </p>
      <div className="feature-grid">
        <div className="feature">
          <strong>01</strong>
          <span>Research coaches worldwide.</span>
        </div>
        <div className="feature">
          <strong>02</strong>
          <span>Research professional teams.</span>
        </div>
        <div className="feature">
          <strong>03</strong>
          <span>Learn about leagues from players.</span>
        </div>
      </div>
    </div>
    <div className="auth-card">
      <div className="eyebrow">CREATE ACCOUNT</div>
      <h2>Start your HoopCheck account.</h2>
      <p className="intro">
        Create a free account to begin researching the basketball world.
      </p>
      <form onSubmit={handleSignup}>
        <label htmlFor="name">Full Name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your full name"
          autoComplete="name"
          required
        />
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 6 characters"
          autoComplete="new-password"
          required
        />
        <div className="legal-consent">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={isAdult}
              onChange={(event) => setIsAdult(event.target.checked)}
            />
            <span>
              I confirm that I am 18 years of age or older.
            </span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(event) =>
                setAgreedToTerms(event.target.checked)
              }
            />
            <span>
              I agree to the{" "}
              <Link href="/terms">Terms of Service</Link> and acknowledge
              the <Link href="/privacy">Privacy Policy</Link>. I have also
              reviewed the{" "}
              <Link href="/community-guidelines">
                Community Guidelines
              </Link>
              .
            </span>
          </label>
        </div>
        {error && (
          <div className="message error">{error}</div>
        )}
        {message && (
          <div className="message success">{message}</div>
        )}
        <button
          type="submit"
          className="btn submit"
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Create Free Account"}
        </button>
      </form>
      <div className="login-link">
        Already have an account?{" "}
        <Link href="/login">Log in</Link>
      </div>
    </div>
  </section>
</main>

);
}
