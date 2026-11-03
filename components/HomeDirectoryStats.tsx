"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Stat = { label: string; value: number | null };
const roundDown = (value: number) => value > 0 ? Math.floor(value / 10) * 10 : null;

export default function HomeDirectoryStats() {
  const [stats, setStats] = useState<Stat[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true })
        .eq("account_type", "player").eq("profile_visibility", "public")
        .neq("moderation_status", "suspended").not("username", "is", null),
      supabase.from("coaches").select("id", { count: "exact", head: true }),
      supabase.from("teams").select("id", { count: "exact", head: true })
        .eq("active", true).eq("basketball_type", "mens"),
      supabase.from("leagues").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("profiles").select("id", { count: "exact", head: true })
        .eq("account_type", "agent").eq("profile_visibility", "public")
        .neq("moderation_status", "suspended").not("username", "is", null),
    ]).then(([players, coaches, teams, leagues, agents]) => {
      if (!active) return;
      const results = [
        { label: "Players", count: players.count },
        { label: "Coaches", count: coaches.count },
        { label: "Teams", count: teams.count },
        { label: "Leagues", count: leagues.count },
        { label: "Agents", count: agents.count },
      ];
      setStats(results.map(item => ({ label: item.label, value: item.count == null ? null : roundDown(item.count) })));
    }).catch(() => { if (active) setStats([]); });
    return () => { active = false; };
  }, []);

  if (!stats.length) return null;
  return <section className="hc-home-directory-stats" aria-label="Live directory totals">
    {stats.map(stat => <div className="hc-home-directory-stat" key={stat.label}>
      <strong>{stat.value == null ? "—" : `${stat.value.toLocaleString()}+`}</strong>
      <span>{stat.label}</span>
    </div>)}
  </section>;
}
