"use client";

import { useState } from "react";
import { googleAuthMessage } from "../lib/google-auth";
import { supabase, supabaseKey, supabaseUrl } from "../lib/supabase";

export default function GoogleSignInButton({ disabled }: { disabled?: boolean }) {
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState("");

  async function start() {
    setStarting(true);
    setMessage("");
    try {
      const settings = await fetch(new URL("/auth/v1/settings", supabaseUrl), {
        headers: { apikey: supabaseKey },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!settings.ok) throw new Error("Could not check Google availability");
      const providers = await settings.json();
      if (providers.external?.google !== true) {
        setMessage("Google sign-in is currently unavailable. You can continue with email.");
        setStarting(false);
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: ["hoopcheck.online","www.hoopcheck.online","hoopcheck-hoopcheck.vercel.app"].includes(window.location.hostname) ? "https://hoopcheck.online/auth/callback" : new URL("/auth/callback", window.location.origin).href },
      });
      if (error) {
        setMessage(googleAuthMessage(error.code));
        setStarting(false);
      }
    } catch {
      setMessage(googleAuthMessage());
      setStarting(false);
    }
  }

  return (
    <div className="hc-google-auth">
      <button type="button" className="hc-google-button" disabled={disabled || starting}
        onClick={start}>
        <svg className="hc-google-mark" aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
          <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
          <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.5l-6.6-5.1c-1.8 1.2-4.2 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z" />
          <path fill="#FBBC05" d="M12.6 28a12 12 0 0 1 0-8V14.7H5.8a20 20 0 0 0 0 18.6l6.8-5.3Z" />
          <path fill="#EA4335" d="M24 11.6c3 0 5.6 1 7.8 3.1l5.8-5.8A19.2 19.2 0 0 0 24 4 20 20 0 0 0 5.8 14.7l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z" />
        </svg>
        {starting ? "Opening Google…" : "Continue with Google"}
      </button>
      {message && <p role="alert" className="hc-auth-feedback">{message}</p>}
    </div>
  );
}
