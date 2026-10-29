"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Stop = { id: string; player_id: string; team_name: string; seasons: string; position: string | null; country: string };
type Player = { id: string; display_name: string | null };

export default function TeamPlayersHistory({ teamId }: { teamId: string }) {
  const [rows, setRows] = useState<Array<Stop & { display_name: string | null }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase.from("player_career_stops")
        .select("id,player_id,team_name,seasons,position,country")
        .eq("team_id", teamId).eq("is_public", true)
        .order("stop_order", { ascending: true }).limit(100);
      if (error || !data?.length) { if (active) { setRows([]); setLoaded(true); } return; }
      const ids = Array.from(new Set(data.map(row => row.player_id)));
      const { data: profiles } = await supabase.from("profiles").select("id,display_name").in("id", ids);
      const names = new Map(((profiles || []) as Player[]).map(profile => [profile.id, profile.display_name]));
      if (active) {
        setRows((data as Stop[]).map(row => ({ ...row, display_name: names.get(row.player_id) || null })));
        setLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [teamId]);

  return <section id="players" className="hero hc-team-players-history">
    <div className="eyebrow">PLAYER HISTORY</div>
    <h2>Players who played here</h2>
    {!loaded ? <p className="muted">Loading public player history…</p> : rows.length ? <div className="hc-team-players-grid">
      {rows.map(row => <article className="card" key={row.id}>
        <h3>{row.display_name || "HoopCheck player"}</h3>
        <p className="muted">{row.position ? row.position + " · " : ""}{row.seasons}</p>
        <p className="muted">{row.country}</p>
      </article>)}
    </div> : <p className="muted">No players have added a public career-history entry for this team yet.</p>}
  </section>;
}
