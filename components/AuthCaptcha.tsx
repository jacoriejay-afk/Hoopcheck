"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";

// Deliberately independent of the public business inquiry widget configuration.
const siteKey = process.env.NEXT_PUBLIC_AUTH_TURNSTILE_SITE_KEY?.trim();
export function useAuthCaptcha() {
  const token = useRef("");
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const onToken = useCallback((value: string) => {
    token.current = value;
    setReady(Boolean(value));
  }, []);
  const takeToken = useCallback(() => {
    if (!siteKey) return undefined;
    const value = token.current;
    if (!value) throw new Error("Complete the security check before continuing.");
    token.current = "";
    setReady(false);
    setRevision(previous => previous + 1);
    return value;
  }, []);
  return { enabled: Boolean(siteKey), ready: !siteKey || ready, revision, onToken, takeToken };
}
export function AuthCaptcha({ onToken }: { onToken: (token: string) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!siteKey || !loaded || !mount.current || !window.turnstile) return;
    let active = true;
    let widget: string | undefined;
    try {
      widget = window.turnstile.render(mount.current, {
        sitekey: siteKey,
        callback: value => { if (active) { setMessage(""); onToken(value); } },
        "expired-callback": () => { if (active) { onToken(""); setMessage("Security check expired. Complete it again."); } },
        "error-callback": () => { if (active) { onToken(""); setMessage("Security check failed. Retry below."); } },
      });
    } catch { onToken(""); setMessage("Security check unavailable. Retry below."); }
    return () => {
      active = false;
      if (widget !== undefined) window.turnstile?.remove(widget);
    };
  }, [loaded, onToken, retry]);
  if (!siteKey) return null;
  return <div className="hc-auth-captcha">
    <div ref={mount} aria-label="Security verification" />
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setLoaded(true)} onError={() => { onToken(""); setMessage("Security check could not load. Refresh this page to try again."); }} />
    {message && <p role="status">{message} {loaded && <button type="button" onClick={() => { onToken(""); setMessage(""); setRetry(value => value + 1); }}>Retry security check</button>}</p>}
  </div>;
}
