"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HoopLoading from "../../../components/HoopLoading";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";\nimport FollowButton from "../../../components/FollowButton";

type Player = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  bio: string | null;
  player_position: string | null;
  years_pro: number | null;
  current_country: string | null;
  current_team: string | null;
  player_verified: boolean;
  player_verified_at: string | null;
};

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportMessage, setReportMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .rpc("get_public_player_profile", { p_user_id: params.id });

      if (!error && data?.[0]) setPlayer(data[0]);
      setLoading(false);
    }

    if (params.id) load();
  }, [params.id]);


  async function reportProfile(){
    const reason=window.prompt("Why are you reporting this profile?");
    if(!reason?.trim()) return;
    const {data:{session}}=await supabase.auth.getSession();
    if(!session) { window.location.href="/login"; return; }
    const res=await fetch("/api/profile-reports",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({profileId:player?.id,reason})});
    const body=await res.json().catch(()=>({})); setReportMessage(res.ok?"Report submitted for review.":(body.error||"Unable to submit report."));
  }

  if (loading) {
    return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading player profile..." /></div></main>;
  }

  if (!player) {
    return (
      <main className="page-shell">
        <div className="page-container">
          <header className="topbar">
            <Link href="/" className="brand">HOOPCHECK</Link>
            <nav className="topnav"><button type="button" onClick={() => window.history.back()} style={{background:"transparent",border:"1px solid #333",color:"inherit",borderRadius:7,padding:"7px 10px",cursor:"pointer"}}>← Back</button><Link href="/search">Search</Link><Link href="/dashboard">Dashboard</Link></nav>
          </header>
          <section className="hero-card">
            <div>
              <p className="eyebrow">PLAYER PROFILE</p>
              <h1>Profile unavailable</h1>
              <p className="muted">This player profile is private or does not exist.</p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell player-profile-page">
      <div className="page-container">
        <header className="topbar">
          <Link href="/" className="brand">HOOPCHECK</Link>
          <nav className="topnav">
            <Link href="/search">Search</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/account">Account</Link>
          </nav>
        </header>

        <section className="player-profile-hero">
          <div className="player-profile-avatar">{player.display_name?.trim()?.charAt(0)?.toUpperCase() || "P"}</div>
          <div className="player-profile-heading">
            <p className="eyebrow">PLAYER PROFILE</p>
            <h1>
              {player.display_name || "HoopCheck Player"}
              {player.player_verified && (
                <span title="Verified professional player" style={{ color: "var(--orange)", marginLeft: 10 }}>✓</span>
              )}
            </h1>
            <p className="muted">
              {player.player_verified ? "Verified professional player" : "HoopCheck player"}
            </p>
          </div>
        </section>

        <section className="player-profile-grid">
          <div className="player-profile-card">
            <span className="card-kicker">PLAYER</span>
            <h2>Basketball Background</h2>
            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              {player.player_position && <p><strong>Position:</strong> {player.player_position}</p>}
              {player.years_pro !== null && <p><strong>Years pro:</strong> {player.years_pro}</p>}
              {player.country && <p><strong>Home country:</strong> {player.country}</p>}
              {player.current_country && <p><strong>Current country:</strong> {player.current_country}</p>}
              {player.current_team && <p><strong>Current team:</strong> {player.current_team}</p>}
            </div>
          </div>

          <div className="dashboard-card">
            <span className="card-kicker">ABOUT</span>
            <h2>Player Bio</h2>
            <p>{player.bio || "This player has not added a public bio yet."}</p>
          </div>
        </section>

        <section className="dashboard-card" style={{ marginTop: 24 }}>
          <span className="card-kicker">HOOPCHECK</span>
          <h2>Player Experience Matters</h2>
          <p className="muted">
            HoopCheck gives professional players a place to research basketball environments and share first-hand experiences.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <Link href="/search" className="btn">Explore HoopCheck</Link>
            <Link href="/account" className="btn dark">My Account</Link><button type="button" className="btn dark" onClick={reportProfile}>Report Profile</button>{reportMessage&&<span className="muted">{reportMessage}</span>}
          </div>
        </section>
      </div>
    </main>
  );
}
