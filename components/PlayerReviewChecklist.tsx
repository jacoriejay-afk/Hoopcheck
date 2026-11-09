"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TeamLeaguePicker from "./TeamLeaguePicker";
import { supabase } from "../lib/supabase";
import { hasActiveMembershipAtLeast } from "../lib/membership-tier";

export default function PlayerReviewChecklist({ userId, basketballType, teamId, onTeamChange, emailConfirmed, isAdmin = false }: {
  userId: string; basketballType: "mens" | "womens"; teamId: string; onTeamChange: (id: string) => void; emailConfirmed: boolean; isAdmin?: boolean;
}) {
  const [state, setState] = useState({ loading: true, verified: false, affiliated: false, paid: false, error: "" });
  const [firsthand, setFirsthand] = useState(false);
  useEffect(() => {
    let active = true;
    setFirsthand(false);
    setState({ loading: true, verified: false, affiliated: false, paid: false, error: "" });
    void (async () => {
      const [profile, subscription, eligibility] = await Promise.all([
        supabase.from("profiles").select("player_verified,selected_womens_team_id").eq("id", userId).maybeSingle(),
        supabase.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", userId).maybeSingle(),
        teamId && basketballType === "mens" ? supabase.rpc("can_user_review_team", { p_user_id: userId, p_team_id: teamId }) : Promise.resolve({ data: false, error: null }),
      ]);
      if (profile.error || subscription.error || eligibility.error) throw profile.error || subscription.error || eligibility.error;
      if (active) setState({ loading: false, verified: profile.data?.player_verified === true,
        affiliated: !!teamId && (basketballType === "womens" ? profile.data?.selected_womens_team_id === teamId : eligibility.data === true || isAdmin),
        paid: hasActiveMembershipAtLeast(subscription.data) || (basketballType === "mens" && isAdmin), error: "" });
    })().catch(() => { if (active) setState({ loading: false, verified: false, affiliated: false, paid: false, error: "Could not check review eligibility. Choose the team again or refresh to retry." }); });
    return () => { active = false; };
  }, [userId, teamId, basketballType, isAdmin]);
  const checks = [
    { label: "Email address confirmed", done: emailConfirmed, href: "/verification" },
    { label: "Player identity verified", done: state.verified, href: "/verification" },
    { label: "Playing history with this team verified", done: state.affiliated, href: state.verified ? "/support" : "/verification" },
    { label: "Active Pro or Premium membership", done: state.paid, href: "/membership" },
  ];
  const ready = !!teamId && !state.loading && !state.error && checks.every(check => check.done) && firsthand;
  return <section id="team-review-checklist" className="hc-player-review-checklist" aria-labelledby="team-review-title">
    <p className="eyebrow">YOUR PLAYING EXPERIENCE</p><h2 id="team-review-title">Review a team</h2>
    <p className="muted">Choose a current or former team you played for. Profile selections are self-reported; review access requires verified playing history.</p>
    <TeamLeaguePicker mode="team" label="Team to review" value={teamId} onChange={onTeamChange} basketballType={basketballType} directorySource={basketballType === "womens" ? "womens_teams" : "teams"} placeholder="Choose a team you played for" />
    <ul aria-label="Team review checklist" aria-busy={state.loading}>{checks.map(check => <li key={check.label}><span aria-hidden="true">{check.done ? "✓" : "○"}</span><span>{check.label}</span><small>{state.loading ? "Checking…" : check.done ? "Complete" : <Link href={check.href}>Action needed →</Link>}</small></li>)}</ul>
    <label className="checkbox-row"><input type="checkbox" checked={firsthand} onChange={event => setFirsthand(event.target.checked)} /><span>I’ll describe my own playing experience, choose the correct season, and avoid sharing private information.</span></label>
    {!emailConfirmed && <p className="muted">Confirm your email using the link in your signup email.</p>}
    {state.error && <p role="alert">{state.error}</p>}
    {ready ? <Link href={`/${basketballType === "womens" ? "womens" : "teams"}/${encodeURIComponent(teamId)}/review`} className="btn">Continue to review</Link> : <p className="muted" role="status">Complete the checklist to continue. Verification and membership are checked again on the review page.</p>}
  </section>;
}
