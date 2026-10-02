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

    const { error } =
      await supabase.auth.signInWithPassword(
        {
          email: normalizedEmail,
          password,
        }
      );

    if (error) {
      setMessage(error.message);
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
      </nav>

      <section className="form">
        <h1>
          Welcome back
        </h1>

        <p className="muted">
          Log in to your HoopCheck
          account.
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
          >
            {loading
              ? "Logging in..."
              : "Log in"}
          </button>
        </form>

        {message && (
          <p
            className="muted"
            role="alert"
            aria-live="polite"
          >
            {message}
          </p>
        )}

        <p className="muted">
          Don't have an account?{" "}
          <Link href="/signup">
            Create one
          </Link>
        </p>
      </section>
    </main>
  );
}
