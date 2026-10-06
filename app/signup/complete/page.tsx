"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type AccountType = "player" | "fan" | "scout" | "agent";
type Team = { id: string; name: string; country: string | null };

function Complete() {
  const params = useSearchParams();
  const email = params.get("email");
  const [accountType, setAccountType] = useState<AccountType>("player");
  const [basketballType, setBasketballType] = useState<"mens" | "womens">("mens");
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadTeams() {
      const table = basketballType === "womens" ? "womens_teams" : "teams";
      const { data } = await supabase.from(table).select("id,name,country").eq("active", true).order("name").limit(500);
      setTeams((data ?? []) as Team[]);
      setFavoriteTeams([]);
    }
    void loadTeams();
  }, [basketballType]);

  async function continueProfile() {
    const setup = { accountType, basketballType, favoriteTeamIds: favoriteTeams };
    localStorage.setItem("hoopcheck_profile_setup", JSON.stringify(setup));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const favoriteNames = teams.filter(t => favoriteTeams.includes(t.id)).map(t => t.name);
      await supabase.from("profiles").update({
        account_type: accountType,
        basketball_type: basketballType,
        favorite_teams: favoriteNames.join(", "),
      }).eq("id", user.id);
    }
    setSaved(true);
  }

  return (
    <main className="page-shell">
      <div className="page-container" style={{ maxWidth: 920, margin: "0 auto", padding: "54px 20px 90px" }}>
        <section className="hero-card">
          <p className="eyebrow">WELCOME TO HOOPCHECK</p>
          <h1>Let’s build your experience.</h1>
          <p className="muted" style={{ fontSize: 17, lineHeight: 1.7 }}>
            Your account is created{email ? " for " + email : ""}. Choose how you’ll use HoopCheck so we can personalize what you see.
          </p>
        </section>

        <section className="dashboard-card" style={{ marginTop: 18 }}>
          <p className="eyebrow">01 · ACCOUNT TYPE</p>
          <h2>What best describes you?</h2>
          <div className="result-grid" style={{ marginTop: 16 }}>
            {([
              ["player", "Player", "Build your professional player profile, verify your club, and share verified experiences."],
              ["fan", "Fan", "Follow players and teams, explore basketball, and keep up with the community."],
              ["scout", "Scout", "Research players, teams, leagues, and follow talent you want to track."],
              ["agent", "Agent", "Research organizations and players and follow the people you represent or recruit."]
            ] as const).map(([value, title, description]) => (
              <button key={value} type="button" onClick={() => setAccountType(value)} className="dashboard-card"
                style={{ textAlign: "left", border: accountType === value ? "2px solid var(--orange)" : "1px solid var(--border)", cursor: "pointer" }}>
                <span className="card-kicker">{accountType === value ? "✓ SELECTED" : "SELECT"}</span>
                <h3>{title}</h3><p className="muted">{description}</p>
              </button>
            ))}
          </div>
        </section>

        {accountType === "player" && (
          <section className="dashboard-card" style={{ marginTop: 18 }}>
            <p className="eyebrow">02 · BASKETBALL</p>
            <h2>Which game are you playing?</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <button className={basketballType === "mens" ? "btn" : "btn dark"} onClick={() => setBasketballType("mens")}>Men’s Basketball</button>
              <button className={basketballType === "womens" ? "btn" : "btn dark"} onClick={() => setBasketballType("womens")}>Women’s Basketball</button>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>Women’s players get the same profile, verification, review, follow, and membership experience with a separate women’s database.</p>
          </section>
        )}

        <section className="dashboard-card" style={{ marginTop: 18 }}>
          <p className="eyebrow">03 · FAVORITE TEAM</p>
          <h2>Pick a team to follow</h2>
          <select multiple value={favoriteTeams} onChange={(e) => setFavoriteTeams(Array.from(e.target.selectedOptions).map(o=>o.value).slice(0,5))} style={{ marginTop: 12, minHeight: 180 }}>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.country ? " — " + team.country : ""}</option>)}
          </select>
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Pick up to 5 favorite teams. On iPhone, tap each team you want to select.</p>
        </section>

        <section className="dashboard-card" style={{ marginTop: 18 }}>
          <p className="eyebrow">04 · NEXT STEP</p>
          <h2>Finish your profile</h2>
          <p className="muted">Players will complete verification and locked professional fields. Fans, scouts, and agents can customize their research experience.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            <button className="btn" onClick={continueProfile}>Continue to Profile Setup</button>
            <Link href="/login" className="btn dark">Sign In Later</Link>
          </div>
          {saved && <p className="muted" style={{ marginTop: 12 }}>Saved. Sign in to continue profile setup.</p>}
        </section>
      </div>
    </main>
  );
}

export default function SignupCompletePage() {
  return <Suspense fallback={<main className="page-shell"><div className="page-container">Loading...</div></main>}><Complete /></Suspense>;
}
