"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import PlayerContactButton from "../components/PlayerContactButton";

type PlayerMatch = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  current_team: string | null;
  current_country: string | null;
  player_verified: boolean;
};

export default function PlayerConnectSearch() {
  const [term, setTerm] = useState("");
  const [player, setPlayer] = useState<PlayerMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function findPlayer(event: React.FormEvent) {
    event.preventDefault();
    const value = term.trim().replace(/[%_]/g, "\\$&");
    if (!value) {
      setPlayer(null);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    const { data } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url,current_team,current_country,player_verified")
      .eq("account_type", "player")
      .eq("profile_visibility", "public")
      .neq("moderation_status", "suspended")
      .or(`username.ilike.%${value}%,display_name.ilike.%${value}%`)
      .order("player_verified", { ascending: false })
      .order("display_name", { ascending: true })
      .limit(1)
      .maybeSingle();
    setPlayer((data || null) as PlayerMatch | null);
    setLoading(false);
  }

  return (
    <section className="dashboard-card" style={{ marginTop: 14 }}>
      <div className="card-kicker">PLAYER CONNECT</div>
      <h2 style={{ marginBottom: 6 }}>Find a player to connect</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Search another professional player by username or name, then send a connection request.
      </p>
      <form onSubmit={findPlayer} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="@username or player name"
          aria-label="Find a player by username or name"
          style={{ flex: "1 1 240px" }}
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Finding..." : "Find Player"}
        </button>
      </form>

      {searched && !loading && !player && (
        <p className="muted" style={{ marginBottom: 0 }}>No player found. Check the username and try again.</p>
      )}

      {player && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          {player.avatar_url ? (
            <img src={player.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div className="player-avatar-fallback">HC</div>
          )}
          <div style={{ minWidth: 170, flex: "1 1 180px" }}>
            <strong>{player.display_name || player.username || "HoopCheck Player"} {player.player_verified ? "✓" : ""}</strong>
            <div className="muted">@{player.username || "username unavailable"}</div>
            <div className="muted">{[player.current_team, player.current_country].filter(Boolean).join(" · ")}</div>
          </div>
          <Link className="btn dark" href={"/players/" + player.id}>Profile</Link>
          <PlayerContactButton playerId={player.id} />
        </div>
      )}
    </section>
  );
}
