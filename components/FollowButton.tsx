"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = { targetType: "team" | "player" | "league" | "fan"; targetId: string };

export default function FollowButton({ targetType, targetId }: Props) {
  const [following, setFollowing] = useState(false);
  const [notify, setNotify] = useState(true);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: c } = await supabase.rpc("get_follow_count", {
        p_target_type: targetType,
        p_target_id: targetId,
      });
      if (!mounted) return;
      setCount(Number(c ?? 0));
      setSignedIn(Boolean(user));
      if (!user) return;
      const { data } = await supabase
        .from("follow_relationships")
        .select("notify_reviews,notify_ratings,notify_updates")
        .eq("follower_id", user.id)
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .maybeSingle();
      if (data) {
        setFollowing(true);
        setNotify(Boolean(data.notify_reviews || data.notify_ratings || data.notify_updates));
      }
    })();
    return () => { mounted = false; };
  }, [targetType, targetId]);

  async function toggle() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setBusy(true);
    if (following) {
      const { error } = await supabase.from("follow_relationships").delete()
        .eq("follower_id", user.id).eq("target_type", targetType).eq("target_id", targetId);
      if (!error) {
        setFollowing(false);
        setCount((v) => Math.max(0, v - 1));
      }
    } else {
      const { error } = await supabase.from("follow_relationships").insert({
        follower_id: user.id,
        target_type: targetType,
        target_id: targetId,
        notify_reviews: true,
        notify_ratings: true,
        notify_updates: true,
      });
      if (!error) {
        setFollowing(true);
        setNotify(true);
        setCount((v) => v + 1);
      }
    }
    setSignedIn(true);
    setBusy(false);
  }

  async function toggleNotify() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !following) return;
    const next = !notify;
    const { error } = await supabase.from("follow_relationships").update({
      notify_reviews: next,
      notify_ratings: next,
      notify_updates: next,
    }).eq("follower_id", user.id).eq("target_type", targetType).eq("target_id", targetId);
    if (!error) setNotify(next);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className="btn dark"
        onClick={toggle}
        disabled={busy}
        title={following ? "You are following this profile" : "Follow this profile"}
      >
        {following ? "✓" : "＋"} {following ? "Following" : "Follow"} <span className="muted">· {count} followers</span>
      </button>
      {following && (
        <button
          type="button"
          aria-label="Toggle notifications"
          title="Keep notifications on"
          onClick={toggleNotify}
          style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "transparent", color: "inherit", cursor: "pointer" }}
        >
          {notify ? "🔔 On" : "🔕 Off"}
        </button>
      )}
      {!signedIn && <span className="muted" style={{ fontSize: 12 }}>Sign in to follow</span>}
    </div>
  );
}
