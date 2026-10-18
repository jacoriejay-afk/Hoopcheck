"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCachedSession, supabase } from "../lib/supabase";

type DirectoryTeam = { id: string; name: string; country: string | null; league_name: string | null; city: string | null };

const categories = [
  { number: "01", label: "Men's Teams", description: "Research professional clubs before you sign.", href: "/teams", tag: "CLUB DIRECTORY" },
  { number: "02", label: "Women's Teams", description: "Explore women's clubs and player experiences.", href: "/womens", tag: "WOMEN'S BASKETBALL" },
  { number: "03", label: "Coaches", description: "Learn what players share about coaching.", href: "/coaches", tag: "COACH INTELLIGENCE" },
  { number: "04", label: "Leagues", description: "Compare leagues and understand the competition.", href: "/leagues", tag: "LEAGUE DIRECTORY" },
  { number: "05", label: "Find Players", description: "Search for players by username and connect.", href: "/players", tag: "PLAYER NETWORK" },
  { number: "06", label: "Player Reviews", description: "Read first-hand experiences and ratings.", href: "/search", tag: "PLAYER VOICES" },
  { number: "07", label: "Ratings & Analytics", description: "Explore ratings and review insights.", href: "/search", tag: "RESEARCH TOOLS" },
  { number: "08", label: "Notifications", description: "Keep track of activity on your account.", href: "/notifications", tag: "YOUR ACTIVITY" },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M4 12h15M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [activeRegion, setActiveRegion] = useState<"all" | "europe" | "asia" | "americas">("all");
  const [directoryTeams, setDirectoryTeams] = useState<DirectoryTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("teams")
      .select("id,name,country,league_name,city")
      .eq("active", true)
      .eq("basketball_type", "mens")
      .order("name", { ascending: true })
      .limit(12)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("Unable to load homepage teams:", error);
          setDirectoryTeams([]);
        } else {
          setDirectoryTeams((data || []) as DirectoryTeam[]);
        }
        setTeamsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const filteredTeams = useMemo(() => {
    const europe = ["Albania", "Andorra", "Armenia", "Austria", "Azerbaijan", "Belarus", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Georgia", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Israel", "Italy", "Kosovo", "Latvia", "Lithuania", "Luxembourg", "Malta", "Moldova", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "Russia", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Türkiye", "Turkey", "Ukraine", "United Kingdom"];
    const asia = ["China", "Japan", "South Korea", "Philippines", "India", "Indonesia", "Lebanon", "Jordan", "Saudi Arabia", "United Arab Emirates", "Qatar", "Bahrain", "Iran", "Iraq", "Kazakhstan", "Uzbekistan", "Mongolia", "Kyrgyzstan", "Tajikistan", "Turkmenistan", "Afghanistan", "Bangladesh", "Bhutan", "Brunei", "Cambodia", "Laos", "Malaysia", "Maldives", "Myanmar", "Nepal", "North Korea", "Pakistan", "Singapore", "Sri Lanka", "Taiwan", "Vietnam", "Palestine"];
    const americas = ["United States", "USA", "Canada", "Mexico", "Argentina", "Brazil", "Chile", "Colombia", "Uruguay", "Venezuela", "Peru", "Puerto Rico", "Dominican Republic", "Bahamas", "Jamaica"];
    if (activeRegion === "all") return directoryTeams;
    const allowed = activeRegion === "europe" ? europe : activeRegion === "asia" ? asia : americas;
    return directoryTeams.filter((team) => allowed.includes(team.country || ""));
  }, [activeRegion, directoryTeams]);

  useEffect(() => {
    getCachedSession()
      .then(({ data }) => {
        if (data.session) router.replace("/dashboard");
      })
      .catch(() => undefined);
  }, [router]);

  return (
    <main className="hc-scratch-home hc-redesign-home">
      <section className="hc-redesign-hero">
        <div className="hc-redesign-container hc-redesign-hero-grid">
          <div className="hc-redesign-hero-copy">
            <p className="hc-redesign-eyebrow"><span /> Independent basketball intelligence</p>
            <h1>Know who<br />you’re <em>signing with.</em></h1>
            <p className="hc-redesign-intro">
              Before you commit to your next opportunity, get informed. Research teams, coaches, and leagues through player experiences from around the basketball world.
            </p>
            <div className="hc-redesign-hero-actions">
              <Link href="/directory" className="hc-redesign-primary">Explore the directory <ArrowIcon /></Link>
              <Link href="/search" className="hc-redesign-secondary">Read player reviews <span aria-hidden="true">↗</span></Link>
            </div>
            <div className="hc-redesign-note">
              <span className="hc-redesign-note-mark" aria-hidden="true">HC</span>
              <span><strong>Research before you sign.</strong><small>Built for the global basketball community.</small></span>
            </div>
          </div>

          <div className="hc-redesign-visual" aria-label="HoopCheck basketball graphic">
            <div className="hc-redesign-visual-top"><span>HOOPCHECK / FIELD GUIDE</span><span>NO. 001</span></div>
            <div className="hc-redesign-orbit hc-redesign-orbit-one" />
            <div className="hc-redesign-orbit hc-redesign-orbit-two" />
            <div className="hc-redesign-ball" aria-hidden="true"><i /><b /><span /></div>
            <div className="hc-redesign-visual-cross hc-redesign-cross-one" />
            <div className="hc-redesign-visual-cross hc-redesign-cross-two" />
            <div className="hc-redesign-visual-bottom"><span>KNOW THE GAME</span><span>MAKE YOUR MOVE</span></div>
            <div className="hc-redesign-vertical-label">THE PLAYER'S PERSPECTIVE</div>
          </div>
        </div>
      </section>

      <section className="hc-redesign-principles" aria-label="What HoopCheck helps you research">
        <div className="hc-redesign-container hc-redesign-principles-inner">
          <div><span>01 /</span><strong>Know the team</strong><small>Look beyond the offer.</small></div>
          <div><span>02 /</span><strong>Know the coach</strong><small>Learn from player voices.</small></div>
          <div><span>03 /</span><strong>Know the league</strong><small>Understand your options.</small></div>
          <div><span>04 /</span><strong>Own your move</strong><small>Make informed decisions.</small></div>
        </div>
      </section>

      <section className="hc-redesign-directory" id="directory">
        <div className="hc-redesign-container">
          <div className="hc-redesign-section-heading">
            <div>
              <p className="hc-redesign-eyebrow"><span /> Start your research</p>
              <h2>Your next move<br /><em>starts with knowledge.</em></h2>
            </div>
            <p>Choose what you want to research. Explore the basketball organizations and people that may shape your career.</p>
          </div>

          <div className="hc-redesign-category-grid">
            {categories.map((category) => (
              <Link href={category.href} key={category.number} className="hc-redesign-category">
                <div className="hc-redesign-category-top"><span>{category.number}</span><ArrowIcon /></div>
                <div className="hc-redesign-category-copy">
                  <small>{category.tag}</small>
                  <h3>{category.label}</h3>
                  <p>{category.description}</p>
                </div>
                <span className="hc-redesign-category-link">Explore <span aria-hidden="true">↗</span></span>
              </Link>
            ))}
          </div>
          <div className="hc-redesign-directory-footer">
            <span>THE GLOBAL BASKETBALL NETWORK</span>
            <Link href="/directory">View full directory <ArrowIcon /></Link>
          </div>
        </div>
      </section>


      <section className="hc-redesign-leaderboard" aria-labelledby="hc-redesign-leaderboard-title">
        <div className="hc-redesign-container">
          <div className="hc-redesign-leaderboard-heading">
            <div>
              <p className="hc-redesign-eyebrow"><span /> Explore the club directory</p>
              <h2 id="hc-redesign-leaderboard-title">Men&apos;s <em>teams.</em></h2>
              <p className="hc-redesign-leaderboard-intro">Browse active clubs in HoopCheck&apos;s directory. Open a team profile to explore available information and player reviews.</p>
            </div>
            <Link href="/teams" className="hc-redesign-leaderboard-all">View all teams <ArrowIcon /></Link>
          </div>

          <div className="hc-redesign-region-tabs" role="group" aria-label="Filter teams by region">
            {(["all", "europe", "asia", "americas"] as const).map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => setActiveRegion(region)}
                aria-pressed={activeRegion === region}
                className={activeRegion === region ? "is-active" : ""}
              >
                {region}
              </button>
            ))}
          </div>

          <div className="hc-redesign-team-list" aria-live="polite">
            {teamsLoading ? (
              <p className="hc-redesign-team-state">Loading teams from the directory…</p>
            ) : filteredTeams.length ? (
              filteredTeams.map((team) => (
                <Link href={`/teams/${team.id}`} key={team.id} className="hc-redesign-team-row">
                  <span className="hc-redesign-team-mark" aria-hidden="true">{team.name.charAt(0)}</span>
                  <span className="hc-redesign-team-main">
                    <strong>{team.name}</strong>
                    <small>{[team.city, team.country].filter(Boolean).join(", ") || "Location not listed"}</small>
                  </span>
                  <span className="hc-redesign-team-league">{team.league_name || "League not listed"}</span>
                  <ArrowIcon />
                </Link>
              ))
            ) : (
              <div className="hc-redesign-team-state">
                {activeRegion === "all" ? "No active teams are available right now." : `No teams from ${activeRegion} are in this current selection.`}
                <p>Try another region or open the full directory to search all active teams.</p>
              </div>
            )}
          </div>
          <p className="hc-redesign-data-note">Team listings reflect directory records and are not live game scores or a ranking.</p>
        </div>
      </section>

      <section className="hc-redesign-cta-section">
        <div className="hc-redesign-container">
          <div className="hc-redesign-cta">
            <div className="hc-redesign-cta-symbol" aria-hidden="true"><span>HC</span><i /></div>
            <div className="hc-redesign-cta-copy">
              <p className="hc-redesign-eyebrow"><span /> Your career. Your research.</p>
              <h2>Don’t sign blind.</h2>
              <p>Use player-shared experiences to ask better questions, spot potential concerns, and prepare for your next opportunity. Reviews are a starting point for research—not a substitute for your own due diligence.</p>
            </div>
            <div className="hc-redesign-cta-actions">
              <Link href="/signup" className="hc-redesign-primary">Create your account <ArrowIcon /></Link>
              <Link href="/membership" className="hc-redesign-cta-text-link">Explore membership <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
