"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getCachedSession, supabase } from "../../lib/supabase";
import PlayerContactButton from "../../components/PlayerContactButton";

type Coach = { id: string; name: string; country: string | null; city: string | null };
type Team = { id: string; name: string; country: string | null; city: string | null; league_name: string | null };
type League = { id: string; name: string; country: string | null; level: string | null };
type Player = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  player_position: string | null;
  years_pro: number | null;
  current_country: string | null;
  current_team: string | null;
  player_verified: boolean;
};

function PlayerUsernameConnect() {
  const [username, setUsername] = useState("");
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function findPlayer(event: React.FormEvent) {
    event.preventDefault();
    const value = username.trim().replace(/^@+/, "");
    setMessage("");
    setPlayer(null);
    if (!value) {
      setMessage("Enter the player username first.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url,current_team,current_country,player_verified")
      .eq("account_type", "player")
      .eq("profile_visibility", "public")
      .neq("moderation_status", "suspended")
      .ilike("username", value)
      .maybeSingle();
    setLoading(false);

    if (error) {
      setMessage("We couldn&apos;t find that username. Try again.");
      return;
    }
    if (!data) {
      setMessage("No player found with that username.");
      return;
    }
    setPlayer(data);
  }

  return (
    <div>
      <form onSubmit={findPlayer} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label htmlFor="player-username" className="sr-only">Player username</label>
        <input
          id="player-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="@playerusername"
          autoComplete="off"
          required
          style={{ flex: "1 1 220px" }}
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Finding..." : "Find Player"}
        </button>
      </form>
      {message && <p className="muted" style={{ margin: "8px 0 0" }}>{message}</p>}
      {player && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          {player.avatar_url ? (
            <img src={player.avatar_url} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div className="player-avatar-fallback">HC</div>
          )}
          <div style={{ minWidth: 150, flex: "1 1 180px" }}>
            <strong>{player.display_name || "HoopCheck Player"} {player.player_verified ? "✓" : ""}</strong>
            <div className="muted">@{player.username}</div>
            <div className="muted">{[player.current_team, player.current_country].filter(Boolean).join(" · ")}</div>
          </div>
          <PlayerContactButton playerId={player.id} compact />
        </div>
      )}
    </div>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState(query);
  const [typeFilter, setTypeFilter] = useState<"all" | "players" | "coaches" | "teams" | "leagues">("all");
  const [countryFilter, setCountryFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    async function search() {
      if (!query) {
        setCoaches([]);
        setTeams([]);
        setLeagues([]);
        setPlayers([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const searchTerm = `%${query}%`;

        const [playerResult, coachResult, teamResult, leagueResult] = await Promise.all([
          supabase.rpc("search_public_players", {
            p_query: query,
            p_country: countryFilter,
            p_position: "",
            p_verified_only: verifiedOnly,
            p_limit: 24,
          }),
          supabase.from("coaches").select("id, name, country, city")
            .or(`name.ilike.${searchTerm},country.ilike.${searchTerm},city.ilike.${searchTerm}`)
            .order("name").limit(20),
          supabase.from("teams").select("id, name, country, city, league_name")
            .or(`name.ilike.${searchTerm},country.ilike.${searchTerm},city.ilike.${searchTerm},league_name.ilike.${searchTerm}`)
            .order("name").limit(20),
          supabase.from("leagues").select("id, name, country, level")
            .or(`name.ilike.${searchTerm},country.ilike.${searchTerm},level.ilike.${searchTerm}`)
            .order("name").limit(20),
        ]);

        if (playerResult.error) throw playerResult.error;
        if (coachResult.error) throw coachResult.error;
        if (teamResult.error) throw teamResult.error;
        if (leagueResult.error) throw leagueResult.error;

        setPlayers((playerResult.data || []) as Player[]);
        setCoaches(coachResult.data || []);
        setTeams(teamResult.data || []);
        setLeagues(leagueResult.data || []);
      } catch (err) {
        console.error(err);
        setError("Something went wrong while searching. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    search();
  }, [query, countryFilter, verifiedOnly]);

  useEffect(() => { setSearchInput(query); }, [query]);

  const countries = useMemo(() => Array.from(new Set([
    ...players.map((x) => x.country),
    ...players.map((x) => x.current_country),
    ...coaches.map((x) => x.country),
    ...teams.map((x) => x.country),
    ...leagues.map((x) => x.country),
  ].filter(Boolean) as string[])).sort(), [players, coaches, teams, leagues]);

  const visiblePlayers = typeFilter === "all" || typeFilter === "players"
    ? players.filter((x) => !countryFilter || x.country === countryFilter || x.current_country === countryFilter)
    : [];
  const visibleCoaches = typeFilter === "all" || typeFilter === "coaches"
    ? coaches.filter((x) => !countryFilter || x.country === countryFilter)
    : [];
  const visibleTeams = typeFilter === "all" || typeFilter === "teams"
    ? teams.filter((x) => !countryFilter || x.country === countryFilter)
    : [];
  const visibleLeagues = typeFilter === "all" || typeFilter === "leagues"
    ? leagues.filter((x) => !countryFilter || x.country === countryFilter)
    : [];

  const totalResults = visiblePlayers.length + visibleCoaches.length + visibleTeams.length + visibleLeagues.length;

  return (
    <main className="search-page">
      <nav className="nav">
        <Link href="/" className="logo">Hoop<span>Check</span></Link>
        <div className="links">
          <button type="button" onClick={() => window.history.back()} style={{ background: "transparent", border: "1px solid #333", color: "#fff", borderRadius: 7, padding: "7px 10px", cursor: "pointer" }}>← Back</button>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/login">Log in</Link>
          <Link href="/signup" className="btn">Sign Up</Link>
        </div>
      </nav>

      <section className="dashboard-card" style={{ margin: "0 0 18px", padding: "16px" }}>
        <div className="eyebrow">PLAYER CONNECT</div>
        <h2 style={{ margin: "4px 0 6px" }}>Add a Player</h2>
        <p className="muted" style={{ margin: "0 0 12px" }}>
          Enter the player&apos;s <strong>HoopCheck username</strong> to send them a connection request.
        </p>
        <PlayerUsernameConnect />
      </section>

      <section className="search-hero">
        <div className="eyebrow">Global Research</div>
        <h1>Search the<br />basketball world.</h1>
        <p>Find players, coaches, professional teams, and leagues from around the world.</p>

        <form action="/search" method="get" className="search-form">
          <input
            type="search"
            name="q"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search players, coaches, teams, or leagues..."
            aria-label="Search players, coaches, teams, or leagues"
          />
          <button type="submit" className="btn">Search</button>
        </form>
      </section>

      {query && (
        <section className="results-section">
          <div className="results-header">
            <div>
              <div className="eyebrow">Search Results</div>
              <h2>Results for &quot;{query}&quot;</h2>
            </div>
            {!loading && <div className="result-count">{totalResults} result{totalResults === 1 ? "" : "s"}</div>}
          </div>

          {!loading && !error && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
              {(["all", "players", "coaches", "teams", "leagues"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className="btn dark"
                  onClick={() => setTypeFilter(type)}
                  aria-pressed={typeFilter === type}
                >
                  {type === "all" ? "All" : type[0].toUpperCase() + type.slice(1)}
                </button>
              ))}
              <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} aria-label="Filter by country" style={{ padding: "10px 14px", borderRadius: 8 }}>
                <option value="">All countries</option>
                {countries.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
              <button type="button" className="btn dark" onClick={() => setVerifiedOnly((value) => !value)} aria-pressed={verifiedOnly}>
                {verifiedOnly ? "✓ Verified only" : "Verified only"}
              </button>
            </div>
          )}

          {loading && <div className="state-card"><p>Searching HoopCheck...</p></div>}
          {error && <div className="state-card error"><p>{error}</p></div>}

          {!loading && !error && totalResults === 0 && (
            <div className="state-card">
              <div className="eyebrow">No Matches</div>
              <h3>Nothing found.</h3>
              <p>Try a different player, coach, team, league, country, or city.</p>
            </div>
          )}

          {!loading && !error && visiblePlayers.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><span>01</span><h3>Players</h3></div>
              <div className="result-grid">
                {visiblePlayers.map((player) => (
                  <Link href={`/players/${player.id}`} key={player.id} className="result-card">
                    <div className="result-type">PLAYER</div>
                    <h4>{player.display_name || "HoopCheck Player"} {player.player_verified ? "✓" : ""}</h4>
                    <p>
                      {[
                        player.player_position,
                        player.years_pro ? `${player.years_pro} years pro` : null,
                        player.current_team,
                        player.current_country || player.country,
                      ].filter(Boolean).join(" · ") || "Professional player profile"}
                    </p>
                    <span className="result-link">View Player Profile →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!loading && !error && visibleCoaches.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><span>02</span><h3>Coaches</h3></div>
              <div className="result-grid">
                {visibleCoaches.map((coach) => (
                  <Link href={`/coaches/${coach.id}`} key={coach.id} className="result-card">
                    <div className="result-type">COACH</div>
                    <h4>{coach.name}</h4>
                    <p>{coach.city && coach.country ? `${coach.city}, ${coach.country}` : coach.country || coach.city || "Location unavailable"}</p>
                    <span className="result-link">Research Coach →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!loading && !error && visibleTeams.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><span>03</span><h3>Teams</h3></div>
              <div className="result-grid">
                {visibleTeams.map((team) => (
                  <Link href={`/teams/${team.id}`} key={team.id} className="result-card">
                    <div className="result-type">TEAM</div>
                    <h4>{team.name}</h4>
                    <p>{team.city && team.country ? `${team.city}, ${team.country}` : team.country || team.city || "Location unavailable"}</p>
                    {team.league_name && <div className="result-meta">{team.league_name}</div>}
                    <span className="result-link">Research Team →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!loading && !error && visibleLeagues.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><span>04</span><h3>Leagues</h3></div>
              <div className="result-grid">
                {visibleLeagues.map((league) => (
                  <Link href={`/leagues/${league.id}`} key={league.id} className="result-card">
                    <div className="result-type">LEAGUE</div>
                    <h4>{league.name}</h4>
                    <p>{league.country || "Country unavailable"}</p>
                    {league.level && <div className="result-meta">Level: {league.level}</div>}
                    <span className="result-link">Research League →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </section>
      )}

      {!query && (
        <section className="empty-section">
          <div className="eyebrow">Start Researching</div>
          <h2>Search before<br />you sign.</h2>
          <div className="quick-links">
            <Link href="/coaches" className="quick-card"><span>01</span><strong>Browse Coaches</strong><small>Research player experiences.</small></Link>
            <Link href="/teams" className="quick-card"><span>02</span><strong>Browse Teams</strong><small>Explore professional organizations.</small></Link>
            <Link href="/leagues" className="quick-card"><span>03</span><strong>Browse Leagues</strong><small>Explore leagues worldwide.</small></Link>
          </div>
        </section>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="search-page"><p>Loading search...</p></main>}>
      <SearchContent />
    </Suspense>
  );
}
