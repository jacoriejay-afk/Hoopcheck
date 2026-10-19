"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  targetType: "team" | "coach" | "league";
  targetId: string;
  targetName: string;
};

type WatchState = {
  follow: boolean;
  alert_reviews: boolean;
  alert_ratings: boolean;
  alert_updates: boolean;
  muted: boolean;
  alert_trust_score: boolean;
  alert_roster_spots: boolean;
  alert_pay_warning: boolean;
};

const DEFAULTS: WatchState = {
  follow: false,
  alert_reviews: false,
  alert_ratings: false,
  alert_updates: false,
  muted: false,
  alert_trust_score: true,
  alert_roster_spots: true,
  alert_pay_warning: true,
};

export default function WatchButton({ targetType, targetId, targetName }: Props) {
  const [state, setState] = useState<WatchState>(DEFAULTS);
  const [exists, setExists] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) {
        if (mounted) setBusy(false);
        return;
      }
      const { data: row } = await supabase
        .from("user_watchlists")
        .select("follow,alert_reviews,alert_ratings,alert_updates,muted,alert_trust_score,alert_roster_spots,alert_pay_warning")
        .eq("user_id", user.id)
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .maybeSingle();
      if (mounted) {
        if (row) {
          setExists(true);
          setState({
            follow: row.follow ?? false,
            alert_reviews: row.alert_reviews ?? false,
            alert_ratings: row.alert_ratings ?? false,
            alert_updates: row.alert_updates ?? false,
            muted: row.muted ?? false,
            alert_trust_score: row.alert_trust_score ?? true,
            alert_roster_spots: row.alert_roster_spots ?? true,
            alert_pay_warning: row.alert_pay_warning ?? true,
          });
        }
        setBusy(false);
      }
    });
    return () => { mounted = false; };
  }, [targetId, targetType]);

  async function loadUser() {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      window.location.href = "/login";
      return null;
    }
    return user;
  }

  async function save(next: WatchState) {
    const user = await loadUser();
    if (!user) return;
    setBusy(true);
    const payload = {
      user_id: user.id,
      target_type: targetType,
      target_id: targetId,
      follow: next.follow,
      notify: !next.muted && (next.alert_reviews || next.alert_ratings || next.alert_updates || next.alert_trust_score || (targetType === "team" && (next.alert_roster_spots || next.alert_pay_warning))),
      alert_reviews: next.alert_reviews,
      alert_ratings: next.alert_ratings,
      alert_updates: next.alert_updates,
      muted: next.muted,
      alert_trust_score: next.alert_trust_score,
      alert_roster_spots: next.alert_roster_spots,
      alert_pay_warning: next.alert_pay_warning,
    };
    const result = exists
      ? await supabase.from("user_watchlists").update(payload).eq("user_id", user.id).eq("target_type", targetType).eq("target_id", targetId)
      : await supabase.from("user_watchlists").insert(payload);
    if (!result.error) {
      setState(next);
      setExists(true);
    }
    setBusy(false);
  }

  async function toggleFollow() {
    const next = { ...state, follow: !state.follow };
    await save(next);
  }

  async function toggleAlert(key: "alert_reviews" | "alert_ratings" | "alert_updates" | "alert_trust_score" | "alert_roster_spots" | "alert_pay_warning") {
    const next = { ...state, [key]: !state[key] };
    await save(next);
  }

  const alertCount = [state.alert_reviews, state.alert_ratings, state.alert_updates, state.alert_trust_score, ...(targetType === "team" ? [state.alert_roster_spots, state.alert_pay_warning] : [])].filter(Boolean).length;

  return (
    <div className="watch-control">
      <button
        className={"btn " + (state.follow ? "watching" : "dark")}
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={"Follow and alert settings for " + targetName}
      >
        {busy ? "..." : state.follow ? "✓ Following" : "＋ Follow"}
      </button>
      {open && (
        <div className="watch-menu">
          <strong>FOLLOW {targetType.toUpperCase()}</strong>
          <button type="button" onClick={toggleFollow} disabled={busy}>
            {state.follow ? "✓ Following this " + targetType : "＋ Follow this " + targetType}
          </button>
          <label><input type="checkbox" checked={state.alert_reviews} onChange={() => toggleAlert("alert_reviews")} disabled={busy || !state.follow} /> New player reviews</label>
          <label><input type="checkbox" checked={state.alert_ratings} onChange={() => toggleAlert("alert_ratings")} disabled={busy || !state.follow} /> New ratings</label>
          <label><input type="checkbox" checked={state.alert_updates} onChange={() => toggleAlert("alert_updates")} disabled={busy || !state.follow} /> Organization updates</label>
          <label><input type="checkbox" checked={state.alert_trust_score} onChange={() => toggleAlert("alert_trust_score")} disabled={busy || !state.follow} /> Trust Score moves 5+ points</label>
          {targetType === "team" && <label><input type="checkbox" checked={state.alert_roster_spots} onChange={() => toggleAlert("alert_roster_spots")} disabled={busy || !state.follow} /> New roster spots</label>}
          {targetType === "team" && <label><input type="checkbox" checked={state.alert_pay_warning} onChange={() => toggleAlert("alert_pay_warning")} disabled={busy || !state.follow} /> Pay warnings</label>}
          <label className="hc-watch-mute"><input type="checkbox" checked={state.muted} onChange={() => save({ ...state, muted: !state.muted })} disabled={busy || !state.follow} /> Mute all alerts for this {targetType}</label>
          <small>{!state.follow ? "Follow this organization first to receive alerts." : state.muted ? "Alerts are muted for this profile." : `${alertCount} alert type${alertCount === 1 ? "" : "s"} enabled`}</small>
        </div>
      )}
    </div>
  );
}
