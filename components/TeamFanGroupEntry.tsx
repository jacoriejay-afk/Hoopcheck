"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type Summary = { group_name: string; member_count: number; join_mode: "open" | "approval"; is_member: boolean; has_pending_request: boolean };

export default function TeamFanGroupEntry({ teamId }: { teamId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isFan, setIsFan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () => {
    const [{ data: { user } }, { data: rows }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc("get_team_fan_group_summary", { p_team_id: teamId })
    ]);
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
      setIsFan(profile?.account_type === "fan");
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    setSummary(row || null);
  };
  useEffect(() => { void load(); }, [teamId]);
  async function join() {
    setBusy(true); setMessage("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setMessage("Sign in as a fan to join this group."); setBusy(false); return; }
    const form = new FormData(); form.append("action", "join"); form.append("team_id", teamId);
    const response = await fetch("/api/fan-groups", { method: "POST", headers: { Authorization: "Bearer " + session.access_token }, body: form });
    const result = await response.json().catch(() => ({}));
    setMessage(result.message || (result.requested ? "Join request sent. A moderator will review it." : result.ok ? "You joined the Fan Group." : "Could not join this group."));
    await load(); setBusy(false);
  }
  if (!summary) return null;
  return <section className="hc-team-fan-group-entry">
    <div><p className="eyebrow">FAN HQ · OFFICIAL COMMUNITY</p><h2>{summary.group_name}</h2><p className="muted">{Number(summary.member_count || 0).toLocaleString()} members · {summary.join_mode === "open" ? "Open to join" : "Approval required"}</p></div>
    {isFan && (summary.is_member
      ? <Link className="btn" href={"/team-hub/groups/" + teamId}>Joined · Open Group</Link>
      : <button className="btn" type="button" disabled={busy || summary.has_pending_request} onClick={() => void join()}>{busy ? "Please wait…" : summary.has_pending_request ? "Request Pending" : "Join Fan Group"}</button>)}
    {message && <p className="hc-feed-message" role="status">{message}</p>}
  </section>;
}
