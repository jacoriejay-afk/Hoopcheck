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

    const { error } =
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
      setMessage(error.message);
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
      </nav>

      <section className="form">
        <h1>
          Create your account
        </h1>

        <p className="muted">
          Join HoopCheck and start
          researching basketball
          opportunities worldwide.
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
          >
            {loading
              ? "Creating..."
              : "Create account"}
          </button>
        </form>

        {message && (
          <p
            className="muted"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        )}

        <p className="muted">
          Already have an account?{" "}
          <Link href="/login">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
