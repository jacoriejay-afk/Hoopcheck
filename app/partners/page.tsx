"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Sponsor() {
  const [type, setType] = useState("sponsor");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    const cleanMessage = message.trim();
    if (cleanMessage.length < 10 || cleanMessage.length > 3000) {
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
        window.location.href = "/login";
        return;
      }
      const { error } = await supabase.from("sponsor_inquiries").insert({
        user_id: user.id,
        type,
        message: cleanMessage,
      });
      if (error) {
        setSent("Your inquiry couldn't be submitted. Please try again.");
        return;
      }
      setMessage("");
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
          <h1>Sponsor, donate, or inquire.</h1>
          <p className="muted">
            Interested in sponsoring the basketball community, supporting HoopCheck, or discussing a partnership?
          </p>
        </section>
        <section className="dashboard-card" style={{ marginTop: 18, display: "grid", gap: 12 }}>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="sponsor">Sponsor recommendation / partnership</option>
            <option value="donate">Donate / support</option>
            <option value="inquire">General business inquiry</option>
          </select>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={7}
            minLength={10}
            maxLength={3000}
            required
            placeholder="Tell us what you have in mind..."
          />
          <button className="btn" disabled={saving} onClick={() => void submit()}>{saving ? "Submitting..." : "Submit Inquiry"}</button>
          {sent && <p className="muted">{sent}</p>}
        </section>
      </div>
    </main>
  );
}
