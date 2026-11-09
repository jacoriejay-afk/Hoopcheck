"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";

type TurnstileAPI = {
  render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileAPI }
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function PublicBusinessInquiry() {
  const [loaded, setLoaded] = useState(false);
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState("sponsor");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const mount = useRef<HTMLDivElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !loaded || !mount.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(mount.current, {
      sitekey: siteKey,
      callback: setToken,
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    });
    return () => {
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [loaded]);

  if (!siteKey) return <p role="status">Business inquiries are temporarily unavailable. Please use the existing contact options.</p>;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || !token) return;
    setSending(true);
    setStatus("");
    try {
      const response = await fetch("/api/business-inquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, type, message, website: honeypot.current?.value ?? "", turnstileToken: token }),
      });
      const result = await response.json() as { message?: string };
      setStatus(result.message || (response.ok ? "Inquiry received." : "Submission failed."));
      if (response.ok) {
        setName("");
        setEmail("");
        setMessage("");
      }
    } catch {
      setStatus("Network error. Please retry.");
    } finally {
      setToken("");
      if (widget.current) window.turnstile?.reset(widget.current);
      setSending(false);
    }
  }

  return (
    <section className="dashboard-card" style={{ marginTop: 18 }}>
      <h2>Contact HoopCheck™ business</h2>
      <p className="muted">Sponsors and partners can contact us without creating an account. We use your contact details to review and respond to your inquiry. Read our <Link href="/privacy">Privacy Policy</Link> before submitting.</p>
      <form onSubmit={(event) => void submit(event)} style={{ display: "grid", gap: 12 }} aria-busy={sending}>
        <label htmlFor="business-name">Your name</label>
        <input id="business-name" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={event => setName(event.target.value)} />
        <label htmlFor="business-email">Email</label>
        <input id="business-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
        <label htmlFor="business-type">Inquiry type</label>
        <select id="business-type" value={type} onChange={event => setType(event.target.value)}>
          <option value="sponsor">Sponsorship or partnership</option>
          <option value="donate">Support or donation inquiry</option>
          <option value="inquire">General business inquiry</option>
        </select>
        <label htmlFor="business-message">Message</label>
        <textarea id="business-message" required minLength={10} maxLength={3000} rows={6} value={message} onChange={event => setMessage(event.target.value)} />
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
          <label htmlFor="business-website">Leave this field blank</label>
          <input id="business-website" name="website" ref={honeypot} tabIndex={-1} autoComplete="off" />
        </div>
        <div ref={mount} aria-label="Spam protection verification" />
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setLoaded(true)} />
        <button className="btn" type="submit" disabled={sending || !token} aria-disabled={sending || !token}>{sending ? "Sending…" : "Send business inquiry"}</button>
        {status && <p role="status" className="muted">{status}</p>}
      </form>
    </section>
  );
}
