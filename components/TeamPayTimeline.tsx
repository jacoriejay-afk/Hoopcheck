"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type MonthAggregate = { month: string; total: number; on_time: number; late: number; missing: number };
const options = [
  { value: "on_time", label: "On time" },
  { value: "late", label: "Late" },
  { value: "missing", label: "Missing" },
] as const;
function monthLabel(month: string) {
  return new Date(month + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}
export default function TeamPayTimeline({ teamId }: { teamId: string }) {
  const [months, setMonths] = useState<MonthAggregate[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [status, setStatus] = useState<"on_time" | "late" | "missing">("on_time");
  const [canSubmit, setCanSubmit] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/team-pay-checkins?teamId=" + encodeURIComponent(teamId), { cache: "no-store" });
    const payload = response.ok ? await response.json() : { months: [] };
    setMonths(Array.isArray(payload.months) ? payload.months : []);
  }, [teamId]);
  useEffect(() => {
    void refresh();
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from("profiles").select("account_type,player_verified").eq("id", session.user.id).maybeSingle();
      if (profile?.account_type !== "player" || profile.player_verified !== true) return;
      const { data: eligible } = await supabase.rpc("can_user_review_team", { p_user_id: session.user.id, p_team_id: teamId });
      if (eligible === true) {
        setCanSubmit(true);
        const now = new Date();
        setSelectedMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10));
      }
    })();
  }, [teamId, refresh]);
  async function submit() {
    setBusy(true); setMessage("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMessage("Sign in to submit a check-in."); setBusy(false); return; }
    const response = await fetch("/api/team-pay-checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ teamId, month: selectedMonth, status }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Check-in recorded anonymously." : (result.error || "Unable to submit check-in."));
    if (response.ok) await refresh();
    setBusy(false);
  }
  return <section className="hero hc-team-pay-timeline">
    <div className="eyebrow">PAY TRANSPARENCY</div>
    <h2>Monthly pay check-ins</h2>
    <p className="muted">Anonymous aggregate reports from verified players who played for this team. A month appears only after at least 3 check-ins. Individual submissions are never shown.</p>
    {months.length ? <div className="hc-pay-month-strip" aria-label="Monthly aggregated pay reports" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 16 }}>
      {months.map(item => <article className="card hc-pay-month" key={item.month} style={{ minWidth: 0, padding: 16 }}>
        <h3>{monthLabel(item.month)}</h3><p className="muted">{item.total} anonymous check-ins</p>
        <div className="hc-pay-counts" style={{ display: "grid", gap: 8 }}>
          <span><strong>{item.on_time}</strong> on time</span>
          <span><strong>{item.late}</strong> late</span>
          <span><strong>{item.missing}</strong> missing</span>
        </div>
      </article>)}
    </div> : <p className="muted">No month has enough check-ins to display yet.</p>}
    {canSubmit && <div className="card hc-pay-checkin-form">
      <h3>Log your pay status</h3>
      <p className="muted">One check-in per team per month. Your individual answer is private and never displayed.</p>
      <label htmlFor={"pay-month-" + teamId}>Month</label>
      <input id={"pay-month-" + teamId} type="month" value={selectedMonth.slice(0, 7)} onChange={e => setSelectedMonth(e.target.value + "-01")} />
      <div className="hc-pay-status-options" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0" }}>{options.map(option => <button key={option.value} type="button" aria-pressed={status === option.value} className={status === option.value ? "btn" : "btn dark"} onClick={() => setStatus(option.value)}>{option.label}</button>)}</div>
      <button type="button" className="btn" onClick={submit} disabled={busy || !selectedMonth}>{busy ? "Submitting…" : "Submit one-tap check-in"}</button>
      {message && <p role="status" aria-live="polite">{message}</p>}
    </div>}
  </section>;
}
