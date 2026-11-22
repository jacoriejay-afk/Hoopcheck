"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import "./safety-center.css";

type Ticket = {
  id: string; requester_id: string; subject: string; category: string;
  priority: string; status: string; description: string; created_at: string;
};
type Kind = "all" | "reels" | "scams";
type StatusFilter = "active" | "all" | "resolved";
const REEL = /Reel: https:\/\/hoopcheck\.online\/feed#post-([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})/i;
const typeOf = (ticket: Ticket): Kind =>
  ticket.subject === "Report a HoopFeed Reel" ? "reels" :
  ticket.subject === "Report a suspicious basketball offer" ? "scams" : "all";
const active = (ticket: Ticket) => !["resolved", "closed"].includes(ticket.status);

export default function SafetyCenterPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [kind, setKind] = useState<Kind>("all");
  const [state, setState] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { window.location.replace("/login?returnTo=%2Fadmin%2Fsafety-center"); return; }
      const { data: canModerate, error: roleError } = await supabase.rpc("is_current_user_admin_or_moderator");
      if (roleError || canModerate !== true) {
        setError("An authorized moderator account is required.");
        setLoading(false); return;
      }
      setAuthorized(true);
      // Existing support-ticket RLS permits only ticket owners and moderators;
      // this is a confidential queue and no reports are publicly projected.
      const { data, error: queryError } = await supabase.from("support_tickets")
        .select("id,requester_id,subject,category,priority,status,description,created_at")
        .eq("category", "security")
        .order("created_at", { ascending: false }).limit(300);
      if (queryError) throw queryError;
      setTickets((data || []) as Ticket[]);
      setError("");
    } catch {
      setError("The confidential security queue could not be loaded. Try again.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const shown = useMemo(() => tickets.filter(ticket => {
    if (kind !== "all" && typeOf(ticket) !== kind) return false;
    if (state === "active" && !active(ticket)) return false;
    if (state === "resolved" && active(ticket)) return false;
    const q = search.trim().toLowerCase();
    return !q || [ticket.subject, ticket.description, ticket.status].some(x => x.toLowerCase().includes(q));
  }), [tickets, kind, state, search]);
  const openCount = tickets.filter(active).length;
  const reelCount = tickets.filter(ticket => typeOf(ticket) === "reels" && active(ticket)).length;
  const scamCount = tickets.filter(ticket => typeOf(ticket) === "scams" && active(ticket)).length;

  async function changeTicket(ticket: Ticket, next: string) {
    if (busy) return;
    setError(""); setNotice(""); setBusy(ticket.id);
    try {
      const { error: updateError } = await supabase.rpc("admin_update_support_ticket", {
        p_ticket_id: ticket.id, p_status: next,
      });
      if (updateError) throw updateError;
      setTickets(current => current.map(row => row.id === ticket.id ? { ...row, status: next } : row));
      setNotice("Private ticket moved to " + next.replaceAll("_", " ") + ". No public allegation was published.");
    } catch {
      setError("Ticket update was denied or failed. Your changes were not saved.");
    } finally { setBusy(""); }
  }

  async function hideReel(ticket: Ticket, reelId: string) {
    if (busy) return;
    const reason = reasons[ticket.id]?.trim() || "";
    if (!confirmed[ticket.id] || reason.length < 25 || reason.length > 1000) {
      setError("Independently inspect the reported video, confirm your review, and enter a specific 25–1,000-character moderation reason.");
      return;
    }
    setBusy(ticket.id); setError(""); setNotice("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("No session");
      const response = await fetch("/api/admin/reel-moderation", {
        method: "POST", cache: "no-store",
        headers: { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
        body: JSON.stringify({ postId: reelId, ticketId: ticket.id, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Reel moderation failed.");
      setNotice(result.message || "Video unlisted with an audit record.");
      setConfirmed(previous => ({ ...previous, [ticket.id]: false }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Video moderation failed.");
    } finally { setBusy(""); }
  }

  return <main className="hc-safety-center">
    <header className="hc-safety-hero">
      <p className="eyebrow">HOOPCHECK / TRUST &amp; SAFETY · INTERNAL ONLY</p>
      <h1>Safety Center</h1>
      <p>Confidential Reel reports and suspicious-offer tickets, reviewed by authorized HoopCheck staff. No public accusations are generated from this queue.</p>
      <div className="hc-safety-links"><Link href="/admin/support">All support tickets</Link><Link href="/admin/agent-reviews">Agent verification</Link><Link href="/scam-alerts">Public safety guide</Link></div>
    </header>
    {loading && <section className="hc-safety-state" role="status">Verifying moderator access and loading reports…</section>}
    {!loading && !authorized && <section className="hc-safety-state" role="alert">{error || "You do not have moderator access."}<p><Link href="/dashboard">Return to dashboard</Link></p></section>}
    {!loading && authorized && <>
      <section className="hc-safety-summary" aria-label="Safety queue summary">
        <div><strong>{openCount}</strong><span>Active security tickets</span></div>
        <div><strong>{reelCount}</strong><span>Open Reel reports</span></div>
        <div><strong>{scamCount}</strong><span>Open suspicious-offer reports</span></div>
      </section>
      <section className="hc-safety-toolbar" aria-label="Filter safety reports">
        <div className="hc-safety-chips" role="group" aria-label="Report type">
          {([["all","All security"],["reels","Reels"],["scams","Suspicious offers"]] as const).map(([value,label]) =>
            <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</button>)}
        </div>
        <label htmlFor="hc-safety-status">Ticket status</label>
        <select id="hc-safety-status" value={state} onChange={event => setState(event.target.value as StatusFilter)}>
          <option value="active">Active</option><option value="all">All</option><option value="resolved">Resolved / closed</option>
        </select>
        <label htmlFor="hc-safety-search">Search ticket text</label>
        <input id="hc-safety-search" type="search" placeholder="Subject or case details" value={search} onChange={event => setSearch(event.target.value)} />
        <button type="button" onClick={() => void load()} disabled={loading}>Refresh queue</button>
      </section>
      {error && <p className="hc-safety-error" role="alert">{error}</p>}
      {notice && <p className="hc-safety-note" role="status">{notice}</p>}
      <section className="hc-safety-list" aria-label="Confidential security reports">
        {!shown.length && <div className="hc-safety-state">No security reports match these filters.</div>}
        {shown.map(ticket => {
          const type = typeOf(ticket);
          const reelId = type === "reels" ? ticket.description.match(REEL)?.[1] || null : null;
          return <article key={ticket.id} className="hc-safety-ticket">
            <div className="hc-safety-top"><span>{type === "reels" ? "VIDEO REPORT" : type === "scams" ? "SUSPICIOUS OFFER" : "SECURITY"}</span><span>{ticket.priority.toUpperCase()} · {ticket.status.replaceAll("_", " ").toUpperCase()}</span></div>
            <h2>{ticket.subject}</h2>
            <p className="hc-safety-meta">Reported {new Date(ticket.created_at).toLocaleString()} · Private ticket {ticket.id.slice(0, 8)}</p>
            <p className="hc-safety-description">{ticket.description}</p>
            {reelId && <section className="hc-safety-review" aria-label="Reel moderation">
              <h3>Independent video review</h3>
              <p>This link comes from the reporter, not from a verified moderation finding. Inspect the post and account context before removing a video.</p>
              <Link href={"/feed#post-" + reelId}>Inspect reported Reel in HoopFeed</Link>
              <label htmlFor={"hc-review-reason-" + ticket.id}>Moderation reason and evidence (internal audit, minimum 25 characters)</label>
              <textarea id={"hc-review-reason-" + ticket.id} rows={3} maxLength={1000} value={reasons[ticket.id] || ""}
                onChange={event => setReasons(current => ({ ...current, [ticket.id]: event.target.value }))} placeholder="Describe the applicable community rule and what was independently reviewed. Avoid sensitive personal data." />
              <label className="hc-safety-check"><input type="checkbox" checked={Boolean(confirmed[ticket.id])}
                onChange={event => setConfirmed(current => ({ ...current, [ticket.id]: event.target.checked }))} />
                I independently reviewed the reported video and confirmed that removal is warranted.</label>
              <button type="button" className="hc-safety-danger" disabled={busy === ticket.id || !confirmed[ticket.id]} onClick={() => void hideReel(ticket, reelId)}>
                {busy === ticket.id ? "Recording action…" : "Remove approved Reel & log decision"}
              </button>
            </section>}
            {type === "scams" && <p className="hc-safety-guidance">Keep this report confidential. Independently corroborate official club or agent details; do not publish allegations or mark an individual fraudulent based on one submission.</p>}
            <div className="hc-safety-statuses" aria-label="Change internal ticket status">
              {(["in_progress","waiting_on_user","resolved","closed"] as const).map(next =>
                <button key={next} type="button" disabled={Boolean(busy) || ticket.status === next}
                  onClick={() => void changeTicket(ticket, next)}>{next.replaceAll("_", " ")}</button>)}
            </div>
          </article>;
        })}
      </section>
      <p className="hc-safety-footnote">Reel removal unpublishes only an approved video and records a reviewer-linked audit entry. It does not delete original evidence or restore content automatically. Scam Alert tickets stay private; a public incident bulletin needs a separate legal and moderation review.</p>
    </>}
  </main>;
}
