"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";

import { supabase } from "../../lib/supabase";

export default function SignupPage() {
  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    const trimmedName =
      name.trim();

    const normalizedEmail =
      email.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setMessage(
        "Please enter your name."
      );
      return;
    }

    if (password.length < 6) {
      setMessage(
        "Your password must be at least 6 characters."
      );
      return;
    }

    setLoading(true);

    const {
      error,
    } =
      await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name:
              trimmedName,
          },
        },
      });

    if (error) {
      setMessage(
        error.message
      );
    } else {
      setMessage(
        "Account created! Check your email if confirmation is required."
      );
    }

    setLoading(false);
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
          <Link href="/login">
            Log In
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
          Join HoopCheck
        </div>

        <h1>
          Your next
          <br />
          move starts
          <br />
          here.
        </h1>

        <p>
          Create your free account and start
          researching coaches, teams, and
          leagues around the world.
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
            Player Account
          </div>

          <h2
            style={{
              fontSize: "30px",
              letterSpacing:
                "-1px",
              marginTop: "0",
            }}
          >
            Create your account
          </h2>

          <p className="muted">
            Join the HoopCheck community
            and research your next basketball
            opportunity with more information.
          </p>

          <form
            onSubmit={handleSignup}
          >
            <label htmlFor="name">
              Name
            </label>

            <input
              id="name"
              className="input"
              type="text"
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              placeholder="Your name"
              autoComplete="name"
              minLength={2}
              required
            />

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
              placeholder="Create a password"
              autoComplete="new-password"
              minLength={6}
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
                ? "Creating Account..."
                : "Create Free Account"}
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
                role="status"
                aria-live="polite"
                style={{
                  margin: 0,
                  color:
                    "var(--orange)",
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
            Already have an account?{" "}
            <Link
              href="/login"
              style={{
                color:
                  "var(--orange)",
                fontWeight: 900,
              }}
            >
              Log in
            </Link>
          </p>
        </div>
      </section>

      <section
        className="grid"
        style={{
          maxWidth: "1000px",
        }}
      >
        <div className="card">
          <div className="eyebrow">
            01
          </div>

          <h2>
            Research
          </h2>

          <p>
            Explore coaches, teams, and leagues
            before making your next move.
          </p>
        </div>

        <div className="card">
          <div className="eyebrow">
            02
          </div>

          <h2>
            Learn
          </h2>

          <p>
            Access real player experiences and
            understand what organizations are
            really like.
          </p>
        </div>

        <div className="card">
          <div className="eyebrow">
            03
          </div>

          <h2>
            Share
          </h2>

          <p>
            Give other professional players the
            information you wish you had before
            signing.
          </p>
        </div>
      </section>

      <section className="hero">
        <div className="eyebrow">
          Built For Players
        </div>

        <h2>
          Research first.
          <br />
          Sign smarter.
        </h2>

        <p>
          HoopCheck is built around the
          experiences of professional basketball
          players around the world.
        </p>

        <div className="actions">
          <Link
            href="/membership"
            className="btn"
          >
            View Membership
          </Link>

          <Link
            href="/login"
            className="btn dark"
          >
            Log In
          </Link>
        </div>
      </section>
    </main>
  );
}
