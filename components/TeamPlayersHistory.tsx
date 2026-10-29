"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Player = { id: string; display_name: string | null; username: string | null; position: string | null };

export default function TeamPlayersHistory({ teamId, teamTable = "teams" }: { teamId: string; teamTable?: "teams" | "womens_teams" }) {
  const [rows, setRows] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const teamField = teamTable === "womens_teams" ? "selected_womens_team_id" : "selected_team_id";
      const { data, error } = await supabase.from("profiles")
        .select("id,display_name,username,position")
        .eq("account_type", "player")
        .eq("profile_visibility", "public")
        .eq(teamField, teamId)
        .order("display_name", { ascending: true })
        .limit(100);
      if (active) {
        setRows(error ? [] : (data || []) as Player[]);
        setLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [teamId, teamTable]);

  return <section id="players" className="hero hc-team-players-history">
    <div className="eyebrow">PLAYER DIRECTORY</div>
    <h2>Players associated with this team</h2>
    <p className="muted">Only public player profiles currently linked to this club are shown.</p>
    {!loaded ? <p className="muted">Loading public player profiles…</p> : rows.length ? <div className="hc-team-players-grid">
      {rows.map(player => <article className="card" key={player.id}>
        <h3>{player.display_name || player.username || "HoopCheck player"}</h3>
        <p className="muted">{player.position || "Position not listed"}</p>
        <a className="btn dark" href={"/players/" + player.id}>View player</a>
      </article>)}
    </div> : <p className="muted">No public player profiles are currently linked to this team.</p>}
  </section>;
}
