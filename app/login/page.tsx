"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";

import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const normalizedEmail =
      email.trim().toLowerCase();

    const {
      error,
    } =
      await supabase.auth.signInWithPassword(
        {
          email: normalizedEmail,
          password,
        }
      );

    if (error) {
      setMessage(
        error.message
      );

      setLoading(false);
      return;
    }

    window.location.href =
      "/dashboard";
  }

  return (
    <main>
      <nav className="nav">
        <Link
          href="/"
          className="logo"
        >
          Hoop<span>Check</span>
        </Link>

        <div className="links">
          <Link href="/signup">
            Create Account
          </Link>
        </div>
      </nav>

      <section
        className="hero"
        style={{
          paddingBottom:
            "30px",
        }}
      >
        <div className="eyebrow">
          HoopCheck Player Access
        </div>

        <h1>
          Welcome
          <br />
          back.
        </h1>

        <p>
          Log in to research coaches, teams,
          leagues, and player experiences
          around the world.
        </p>
      </section>

      <section
        style={{
          maxWidth: "520px",
          margin: "0 auto",
          padding:
            "20px 6% 100px",
        }}
      >
        <div className="form">
          <div className="eyebrow">
            Player Login
          </div>

          <h2
            style={{
              fontSize: "30px",
              letterSpacing:
                "-1px",
              marginTop: "0",
            }}
          >
            Sign in to HoopCheck
          </h2>

          <p className="muted">
            Use the email and password
            associated with your account.
          </p>

          <form
            onSubmit={handleLogin}
          >
            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Your password"
              autoComplete="current-password"
              required
            />

            <button
              type="submit"
              className="btn"
              disabled={loading}
              style={{
                width: "100%",
                marginTop: "8px",
              }}
            >
              {loading
                ? "Logging In..."
                : "Log In"}
            </button>
          </form>

          {message && (
            <div
              style={{
                marginTop: "18px",
                padding: "14px",
                border:
                  "1px solid #3a3a3a",
                borderRadius: "8px",
                background:
                  "#0b0b0b",
              }}
            >
              <p
                role="alert"
                aria-live="polite"
                style={{
                  margin: 0,
                  color:
                    "#ff9b4a",
                  lineHeight: 1.5,
                }}
              >
                {message}
              </p>
            </div>
          )}

          <p
            className="muted"
            style={{
              marginTop: "22px",
              marginBottom: 0,
            }}
          >
            Don&apos;t have a HoopCheck
            account?{" "}
            <Link
              href="/signup"
              style={{
                color:
                  "var(--orange)",
                fontWeight: 900,
              }}
            >
              Create one
            </Link>
          </p>
        </div>
      </section>

      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding:
            "0 6% 100px",
        }}
      >
        <div className="card">
          <div className="eyebrow">
            HoopCheck
          </div>

          <h2>
            Research before
            <br />
            you commit.
          </h2>

          <p>
            Your next overseas opportunity can
            change your career. Get more
            information before you sign.
          </p>

          <div className="actions">
            <Link
              href="/coaches"
              className="btn"
            >
              Research Coaches
            </Link>

            <Link
              href="/teams"
              className="btn dark"
            >
              Research Teams
            </Link>

            <Link
              href="/leagues"
              className="btn dark"
            >
              Research Leagues
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
