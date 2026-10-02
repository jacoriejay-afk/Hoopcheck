“use client”;

import { FormEvent, useState } from “react”;
import Link from “next/link”;
import { useRouter } from “next/navigation”;
import { supabase } from “../../lib/supabase”;

const TERMS_VERSION = “2026-10-01”;

export default function SignupPage() {
const router = useRouter();

const [name, setName] = useState(””);
const [email, setEmail] = useState(””);
const [password, setPassword] = useState(””);
const [isAdult, setIsAdult] = useState(false);
const [agreedToTerms, setAgreedToTerms] = useState(false);

const [loading, setLoading] = useState(false);
const [message, setMessage] = useState(””);
const [error, setError] = useState(””);

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
HoopCheck
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
  <style jsx>{`
    .auth-page {
      max-width: 1180px;
      margin: 0 auto;
      padding: 70px 24px 100px;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 70px;
      align-items: center;
    }
    .auth-hero h1 {
      font-size: clamp(48px, 7vw, 86px);
      line-height: 0.95;
      margin: 14px 0 25px;
      letter-spacing: -0.04em;
    }
    .auth-hero > p {
      max-width: 650px;
      color: #bdbdbd;
      font-size: 18px;
      line-height: 1.7;
    }
    .feature-grid {
      display: grid;
      gap: 12px;
      margin-top: 35px;
    }
    .feature {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 18px;
      background: #111;
      border: 1px solid #292929;
      border-left: 3px solid var(--orange);
      border-radius: 10px;
    }
    .feature strong {
      color: var(--orange);
      font-size: 13px;
    }
    .feature span {
      color: #ddd;
      font-weight: 700;
    }
    .auth-card {
      background: #111;
      border: 1px solid #292929;
      border-top: 4px solid var(--orange);
      border-radius: 18px;
      padding: 36px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .auth-card h2 {
      font-size: 30px;
      margin: 10px 0;
    }
    .intro {
      color: #aaa;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .auth-card form {
      display: flex;
      flex-direction: column;
    }
    .auth-card > form > label {
      margin: 16px 0 7px;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #ddd;
    }
    .auth-card input:not([type="checkbox"]) {
      width: 100%;
      box-sizing: border-box;
      padding: 14px 15px;
      border: 1px solid #333;
      border-radius: 9px;
      background: #080808;
      color: #fff;
      font: inherit;
      outline: none;
    }
    .auth-card input:not([type="checkbox"]):focus {
      border-color: var(--orange);
    }
    .legal-consent {
      margin-top: 20px;
      padding: 16px;
      background: #0a0a0a;
      border: 1px solid #292929;
      border-radius: 9px;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    .checkbox-row {
      display: flex;
      align-items: flex-start;
      gap: 11px;
      color: #aaa;
      font-size: 12px;
      line-height: 1.7;
      cursor: pointer;
    }
    .checkbox-row input[type="checkbox"] {
      width: 17px;
      height: 17px;
      flex: 0 0 auto;
      margin-top: 2px;
      accent-color: var(--orange);
      cursor: pointer;
    }
    .checkbox-row a {
      color: var(--orange);
      font-weight: 800;
    }
    .submit {
      width: 100%;
      margin-top: 20px;
      border: 0;
      cursor: pointer;
    }
    .submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .message {
      margin-top: 16px;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.5;
    }
    .error {
      background: #241010;
      border: 1px solid #6b2424;
      color: #ffb1b1;
    }
    .success {
      background: #102417;
      border: 1px solid #245d35;
      color: #b9f0c8;
    }
    .login-link {
      margin-top: 22px;
      text-align: center;
      color: #999;
      font-size: 14px;
    }
    .login-link a {
      color: var(--orange);
      font-weight: 900;
    }
    @media (max-width: 850px) {
      .auth-page {
        grid-template-columns: 1fr;
        gap: 40px;
        padding-top: 45px;
      }
      .auth-hero h1 {
        font-size: 54px;
      }
    }
    @media (max-width: 600px) {
      .auth-page {
        padding-left: 16px;
        padding-right: 16px;
      }
      .auth-card {
        padding: 25px 20px;
      }
    }
  `}</style>
</main>

);
}

Save and commit it to GitHub.
**Don't deploy yet.** Reply **Done**, and then we'll connect those consent values to the `profiles` table automatically.
