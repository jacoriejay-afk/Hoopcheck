"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthState } from "../../components/AuthProvider";
import { supabase } from "../../lib/supabase";

export default function Sponsor() {
  const { signedIn } = useAuthState();
  const [type, setType] = useState("sponsor");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    if (website) { setSent("Your inquiry could not be submitted."); return; }
    if (!consent) { setSent("Please confirm you agree to be contacted about your inquiry."); return; }
    const cleanMessage = message.trim();
    const categoryPrefix = type === "sponsor" || type === "donate" || type === "inquire" ? "" : `[Category: ${type}]\n`;
    const storedMessage = `${categoryPrefix}${cleanMessage}`;
    if (cleanMessage.length < 10 || storedMessage.length > 3000) {
      setSent("Please enter between 10 and 3,000 characters so we can understand your inquiry.");
      return;
    }
    setSaving(true);
    setSent("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setSent("We couldn't verify your session. Please try again.");
        return;
      }
      const user = session?.user;
      if (!user) {
        setSent("Please sign in before submitting. Your draft is still here.");
        return;
      }
      const { error } = await supabase.from("sponsor_inquiries").insert({
        user_id: user.id,
        type: type === "sponsor" || type === "donate" ? type : "inquire",
        message: storedMessage,
      });
      if (error) {
        setSent("Your inquiry couldn't be submitted. Please try again.");
        return;
      }
      setMessage("");
      setConsent(false);
      setSent("Thanks — your inquiry has been submitted.");
    } catch {
      setSent("Something went wrong while submitting your inquiry. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell hc-partners-page">
      <div className="page-container">
        <section className="hero-card">
          <p className="eyebrow">PARTNER WITH HOOPCHECK</p>
          <h1>Business & partnership inquiries.</h1>
          <p className="muted">
            Interested in sponsoring the basketball community, supporting HoopCheck, or discussing a partnership?
          </p>
        </section>
        <section className="dashboard-card" style={{ marginTop: 18, display: "grid", gap: 12 }}>
          {!signedIn && <p role="status" className="muted">A HoopCheck account is currently required to send an inquiry. <Link href="/login?next=/partners">Log in</Link> or <Link href="/signup">create an account</Link> before writing your message.</p>}
          <label htmlFor="partner-inquiry-type" className="font-semibold">Inquiry category</label>
          <select id="partner-inquiry-type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="sponsor">Sponsor recommendation / partnership</option>
            <option value="donate">Donate / support</option>
            <option value="investor">Investor introduction</option>
            <option value="ambassador">Athlete ambassador</option>
            <option value="strategic">Strategic partnership</option>
            <option value="inquire">General business inquiry</option>
          </select>
          <label htmlFor="partner-inquiry-message" className="font-semibold">Tell us about your proposal</label>
          <textarea
            id="partner-inquiry-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={7}
            minLength={10}
            maxLength={3000}
            required
            placeholder="Tell us what you have in mind..."
          />
          <label className="sr-only" htmlFor="partner-website">Website (leave blank)</label>
          <input id="partner-website" name="website" value={website} onChange={event => setWebsite(event.target.value)} autoComplete="off" tabIndex={-1} aria-hidden="true" style={{position:"absolute",left:"-10000px",width:1,height:1}} />
          <label style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
            <span>I agree that HoopCheck™ may contact me about this inquiry. Do not include payment details or sensitive investor documents.</span>
          </label>
          <button className="btn" disabled={saving || !signedIn || !consent} onClick={() => void submit()}>{saving ? "Submitting..." : "Submit Inquiry"}</button>
          {sent && <p role="status" aria-live="polite" className="muted">{sent}</p>}
        </section>
      </div>
    </main>
  );
}
