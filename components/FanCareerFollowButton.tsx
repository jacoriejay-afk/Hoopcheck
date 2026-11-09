"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type Props = { playerId: string; playerName?: string | null };

export default function FanCareerFollowButton({ playerId, playerName }: Props) {
  const [isFan, setIsFan] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setSignedIn(Boolean(user));
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
      if (!active || profile?.account_type !== "fan") return;
      setIsFan(true);
      const { data } = await supabase.from("fan_player_career_follows")
        .select("player_id").eq("fan_id", user.id).eq("player_id", playerId).maybeSingle();
      if (active) setFollowing(Boolean(data));
    })();
    return () => { active = false; };
  }, [playerId]);

  async function toggle() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    setBusy(true);
    if (following) {
      const { error } = await supabase.from("fan_player_career_follows")
        .delete().eq("fan_id", user.id).eq("player_id", playerId);
      if (!error) setFollowing(false);
    } else {
      const { error } = await supabase.from("fan_player_career_follows")
        .insert({ fan_id: user.id, player_id: playerId, notify_team_changes: true });
      if (!error) setFollowing(true);
    }
    setBusy(false);
  }

  if (!isFan) return signedIn ? null : <span className="muted" style={{fontSize:12}}>Sign in as a fan to follow this player's career.</span>;
  return <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
    <button type="button" className={following ? "btn" : "btn dark"} onClick={toggle} disabled={busy}>
      {busy ? "Saving…" : following ? "✓ Following career" : "＋ Follow career"}
    </button>
    <span className="muted" style={{fontSize:12}}>Directory career alerts only · no HoopFeed access</span>
  </div>;
}
