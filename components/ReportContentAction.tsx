"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";
const REASONS = ["Spam or advertising", "Harassment or abusive content", "Hate or discrimination", "Sexual or violent content", "Threats or dangerous content", "Personal information", "False or misleading information", "Other"];
export default function ReportContentAction({ contentType, contentId, contentSnapshot = "" }: { contentType: "review" | "hoopfeed_post" | "fan_feed_post" | "chat_message"; contentId: string; contentSnapshot?: string }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(REASONS[0]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit() {
    setBusy(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setMessage("Sign in to report content."); return; }
      const response = await fetch("/api/content-reports", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ contentType, contentId, contentSnapshot, reason }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Could not submit report.");
      setMessage("Report submitted for review."); setOpen(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit report."); }
    finally { setBusy(false); }
  }
  return <span className="hc-trust-action"><button type="button" className="btn dark" onClick={() => { setOpen(v => !v); setMessage(""); }} aria-expanded={open}>Report</button>
    {open && <span className="hc-trust-report-form"><label>Reason <select value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(item => <option key={item}>{item}</option>)}</select></label>
      <button type="button" className="btn" disabled={busy} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit report"}</button><button type="button" className="btn dark" onClick={() => setOpen(false)}>Cancel</button></span>}
    {message && <small role="status">{message}</small>}</span>;
}
