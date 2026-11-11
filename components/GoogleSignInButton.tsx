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
        options: { redirectTo: !["hoopcheck.online", "www.hoopcheck.online", "hoopcheck-hoopcheck.vercel.app"].includes(window.location.hostname)
          ? new URL("/auth/callback", window.location.origin).href
          : "https://hoopcheck.online/auth/callback" },
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
    <div style={{ marginBlock: 12 }}>
      <button type="button" className="btn dark" disabled={disabled || starting}
        onClick={start} style={{ width: "100%" }}>
        {starting ? "Opening Google…" : "Continue with Google"}
      </button>
      {message && <p role="alert" className="muted">{message}</p>}
    </div>
  );
}
