"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useAuthState } from "./AuthProvider";
import { supabase } from "../lib/supabase";
import { reportVisibleFeedContent, validFeedReportTarget } from "../apps/mobile/src/native/feedReport";

export default function HoopFeedReportAction({ uid, postId, authorId, commentId }: {
  uid: string; postId: string; authorId: string; commentId?: string;
}) {
  const { userId } = useAuthState();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, [userId]);

  const target = { uid, postId, authorId, commentId };
  if (uid !== userId || !validFeedReportTarget(target)) return null;

  async function submit() {
    if (request.current || sent || reason.trim().length < 10) return;
    const controller = new AbortController();
    request.current = controller;
    const active = () => request.current === controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    setBusy(true);
    setNotice("");
    try {
      await reportVisibleFeedContent(supabase, target, reason, controller.signal, active);
      if (!active()) return;
      setOpen(false);
      setSent(true);
      setReason("");
      setNotice("Confidential report submitted to HoopCheck staff.");
    } catch {
      if (active()) setNotice("Report could not be confirmed. Check your support tickets before retrying.");
    } finally {
      clearTimeout(timer);
      if (active()) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  return <div onDoubleClick={event => event.stopPropagation()}>
    <button type="button" className="hc-feed-action-pill" aria-label={commentId ? "Report this comment" : "Report this post"}
      aria-expanded={open} aria-controls={inputId + "-panel"} disabled={sent || busy} onClick={() => setOpen(value => !value)}>
      {sent ? "Reported" : "Report"}
    </button>
    <div id={inputId + "-panel"} hidden={!open}>
      <label htmlFor={inputId}>Why are you reporting this content?</label>
      <textarea id={inputId} rows={3} maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} />
      <div className="actions">
        <button type="button" className="btn" disabled={busy || reason.trim().length < 10} onClick={() => void submit()}>
          {busy ? "Submitting…" : "Submit confidential report"}
        </button>
        <button type="button" className="btn dark" disabled={busy} onClick={() => { setOpen(false); setReason(""); }}>Cancel</button>
      </div>
    </div>
    {notice && <p role="status">{notice}</p>}
  </div>;
}
