"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function WatchButton({ targetType, targetId, targetName }: { targetType: "team" | "coach" | "league"; targetId: string; targetName: string }) {
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { if (mounted) setBusy(false); return; }
      const { data: row } = await supabase.from("user_watchlists").select("id").eq("user_id", data.user.id).eq("target_type", targetType).eq("target_id", targetId).maybeSingle();
      if (mounted) { setWatching(Boolean(row)); setBusy(false); }
    });
    return () => { mounted = false; };
  }, [targetId, targetType]);

  async function toggle() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { window.location.href = "/login"; return; }
    setBusy(true);
    if (watching) {
      await supabase.from("user_watchlists").delete().eq("user_id", userData.user.id).eq("target_type", targetType).eq("target_id", targetId);
      setWatching(false);
    } else {
      const { data: prefs } = await supabase.from("user_preferences").select("notifications_enabled").eq("user_id", userData.user.id).maybeSingle();
      await supabase.from("user_watchlists").insert({ user_id: userData.user.id, target_type: targetType, target_id: targetId, notify: prefs?.notifications_enabled ?? true });
      setWatching(true);
    }
    setBusy(false);
  }

  return <button className={"btn " + (watching ? "watching" : "dark")} type="button" disabled={busy} onClick={toggle} aria-label={watching ? "Stop alerts for " + targetName : "Get alerts for " + targetName}>{busy ? "..." : watching ? "✓ Alerts On" : "＋ Get Alerts"}</button>;
}
