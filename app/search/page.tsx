"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import PlayerContactButton from "../../components/PlayerContactButton";
import { VerifiedBadge } from "../../components/HoopCheckUI";
import SearchBar from "../../components/SearchBar";
import TeamDirectoryRow from "../../components/TeamDirectoryRow";
import Surface from "../../components/Surface";
import { useLanguage } from "../../components/LanguageProvider";

type Coach = { id: string; name: string; country: string | null; city: string | null };
type Team = { id: string; name: string; country: string | null; city: string | null; league_name: string | null };
type WomensTeam = { id: string; name: string; country: string | null; city: string | null; league_name: string | null };
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
      .not("username", "is", null)
      .neq("moderation_status", "suspended")
      .ilike("username", value)
      .maybeSingle();
    setLoading(false);

    if (error) {
      setMessage("We couldn’t find that username. Try again.");
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
        <label htmlFor="player-username" className="sr-only">{t("playerUsername")}</label>
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
            <strong>{player.display_name || t("hoopCheckPlayer")} {player.player_verified && <VerifiedBadge label={t("verifiedPlayer")} />}</strong>
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
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";
  const initialType = searchParams.get("type");

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [womensTeams, setWomensTeams] = useState<WomensTeam[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState(query);
  const [typeFilter, setTypeFilter] = useState<"all" | "players" | "coaches" | "mens-teams" | "womens-teams" | "leagues">(
    initialType === "players" || initialType === "coaches" || initialType === "mens-teams" || initialType === "womens-teams" || initialType === "leagues" ? initialType : "all"
  );
  const [countryFilter, setCountryFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    async function search() {
      if (!query) {
        setCoaches([]);
        setTeams([]);
        setWomensTeams([]);
        setLeagues([]);
        setPlayers([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const searchTerm = `%${query}%`;
        const wantsPlayers = typeFilter === "all" || typeFilter === "players";
        const wantsCoaches = typeFilter === "all" || typeFilter === "coaches";
        const wantsMensTeams = typeFilter === "all" || typeFilter === "mens-teams";
        const wantsWomensTeams = typeFilter === "all" || typeFilter === "womens-teams";
        const wantsLeagues = typeFilter === "all" || typeFilter === "leagues";

        const [playerResult, coachResult, teamResult, womensTeamResult, leagueResult] = await Promise.all([
          wantsPlayers
            ? supabase.rpc("search_public_players", {
                p_query: query,
                p_country: countryFilter,
                p_position: "",
                p_verified_only: verifiedOnly,
                p_limit: 24,
              })
            : Promise.resolve({ data: [], error: null }),
          wantsCoaches
            ? (() => {
                let request = supabase.from("coaches").select("id, name, country, city")
                  .or(`name.ilike.${searchTerm},country.ilike.${searchTerm},city.ilike.${searchTerm}`)
                  .order("name").limit(20);
                if (countryFilter) request = request.eq("country", countryFilter);
                return request;
              })()
            : Promise.resolve({ data: [], error: null }),
          wantsMensTeams
            ? (() => {
                let request = supabase.from("teams").select("id, name, country, city, league_name")
                  .eq("basketball_type", "mens")
                  .or(`name.ilike.${searchTerm},country.ilike.${searchTerm},city.ilike.${searchTerm},league_name.ilike.${searchTerm}`)
                  .order("name").limit(30);
                if (countryFilter) request = request.eq("country", countryFilter);
                return request;
              })()
            : Promise.resolve({ data: [], error: null }),
          wantsWomensTeams
            ? (() => {
                let request = supabase.from("womens_teams").select("id, name, country, city, league_name")
                  .or(`name.ilike.${searchTerm},country.ilike.${searchTerm},city.ilike.${searchTerm},league_name.ilike.${searchTerm}`)
                  .order("name").limit(30);
                if (countryFilter) request = request.eq("country", countryFilter);
                return request;
              })()
            : Promise.resolve({ data: [], error: null }),
          wantsLeagues
            ? (() => {
                let request = supabase.from("leagues").select("id, name, country, level")
                  .or(`name.ilike.${searchTerm},country.ilike.${searchTerm},level.ilike.${searchTerm}`)
                  .order("name").limit(20);
                if (countryFilter) request = request.eq("country", countryFilter);
                return request;
              })()
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (playerResult.error) throw playerResult.error;
        if (coachResult.error) throw coachResult.error;
        if (teamResult.error) throw teamResult.error;
        if (womensTeamResult.error) throw womensTeamResult.error;
        if (leagueResult.error) throw leagueResult.error;


        setPlayers((playerResult.data || []) as Player[]);
        setCoaches(coachResult.data || []);
        setTeams(teamResult.data || []);
        setWomensTeams(womensTeamResult.data || []);
        setLeagues(leagueResult.data || []);
      } catch (err) {
        console.error(err);
        setError("Something went wrong while searching. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    search();
  }, [query, countryFilter, verifiedOnly, typeFilter]);

  useEffect(() => { setSearchInput(query); }, [query]);
  useEffect(() => {
    if (initialType === "players" || initialType === "coaches" || initialType === "mens-teams" || initialType === "womens-teams" || initialType === "leagues") {
      setTypeFilter(initialType);
    }
  }, [initialType]);

  const countries = useMemo(() => Array.from(new Set([
    ...players.map((x) => x.country),
    ...players.map((x) => x.current_country),
    ...coaches.map((x) => x.country),
    ...teams.map((x) => x.country),
    ...womensTeams.map((x) => x.country),
    ...leagues.map((x) => x.country),
  ].filter(Boolean) as string[])).sort(), [players, coaches, teams, womensTeams, leagues]);

  const visiblePlayers = typeFilter === "all" || typeFilter === "players"
    ? players.filter((x) => !countryFilter || x.country === countryFilter || x.current_country === countryFilter)
    : [];
  const visibleCoaches = typeFilter === "all" || typeFilter === "coaches"
    ? coaches.filter((x) => !countryFilter || x.country === countryFilter)
    : [];
  const visibleTeams = typeFilter === "all" || typeFilter === "mens-teams"
    ? teams.filter((x) => !countryFilter || x.country === countryFilter)
    : [];
  const visibleWomensTeams = typeFilter === "all" || typeFilter === "womens-teams"
    ? womensTeams.filter((x) => !countryFilter || x.country === countryFilter)
    : [];
  const visibleLeagues = typeFilter === "all" || typeFilter === "leagues"
    ? leagues.filter((x) => !countryFilter || x.country === countryFilter)
    : [];

  const totalResults = visiblePlayers.length + visibleCoaches.length + visibleTeams.length + visibleWomensTeams.length + visibleLeagues.length;

  return (
    <main className="search-page hc-global-search-page">
      <nav className="hc-directory-switcher" aria-label={t("browseDirectoriesLabel")}>
        <span className="hc-directory-switcher-label">{t("browseDirectoriesLabel")}</span>
        <Link href="/teams">{t("mensTeams")}</Link>
        <Link href="/womens">{t("womensTeams")}</Link>
        <Link href="/coaches">{t("coaches")}</Link>
        <Link href="/leagues">{t("leagues")}</Link>
        <Link href="/players">{t("players")}</Link>
        <Link href="/search">{t("globalSearch")}</Link>
        </nav>
      <Surface as="section" className="dashboard-card hc-player-connect-surface" style={{ margin: "0 0 18px", padding: "16px" }}>
        <div className="eyebrow">{t("playerConnect")}</div>
        <h2 style={{ margin: "4px 0 6px" }}>{t("addAPlayer")}</h2>
        <p className="muted" style={{ margin: "0 0 12px" }}>
          {t("enterPlayerUsername")}
        </p>
        <PlayerUsernameConnect />
      </Surface>

      <section className="search-hero">
        <div className="eyebrow">{t("globalResearch")}</div>
        <h1>{t("searchBasketballWorld")}</h1>
        <p>{t("findBasketballPeople")}</p>

        <SearchBar
          className="search-form"
          name="q"
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("searchPeoplePlaceholder")}
          ariaLabel={t("searchPeoplePlaceholder")}
        />
      </section>

      {query && (
        <section className="results-section">
          <div className="results-header">
            <div>
              <div className="eyebrow">{t("searchResults")}</div>
              <h2>{t("resultsFor")} &quot;{query}&quot;</h2>
            </div>
            {!loading && <div className="result-count">{totalResults} {t("resultCount")}</div>}
          </div>

          {!loading && !error && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
              {(["all", "players", "coaches", "mens-teams", "womens-teams", "leagues"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className="btn dark"
                  onClick={() => setTypeFilter(type)}
                  aria-pressed={typeFilter === type}
                >
                  {type === "all" ? t("all") : type === "mens-teams" ? t("mensTeams") : type === "womens-teams" ? t("womensTeams") : type === "players" ? t("players") : type === "coaches" ? t("coaches") : t("leagues")}
                </button>
              ))}
              <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} aria-label={t("country")} style={{ padding: "10px 14px", borderRadius: 8 }}>
                <option value="">{t("allCountries")}</option>
                {countries.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
              <button type="button" className="btn dark" onClick={() => setVerifiedOnly((value) => !value)} aria-pressed={verifiedOnly}>
                {verifiedOnly ? <><VerifiedBadge label={t("verifiedFilterActive")} /> {t("verifiedOnly")}</> : t("verifiedOnly")}
              </button>
            </div>
          )}

          {loading && <div className="state-card"><p>{t("searchingHoopCheck")}</p></div>}
          {error && <div className="state-card error"><p>{error}</p></div>}

          {!loading && !error && totalResults === 0 && (
            <div className="state-card">
              <div className="eyebrow">{t("noMatches")}</div>
              <h3>{t("nothingFound")}</h3>
              <p>{t("tryDifferentSearch")}</p>
            </div>
          )}

          {!loading && !error && visiblePlayers.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><span>01</span><h3>{t("players")}</h3></div>
              <div className="result-grid">
                {visiblePlayers.map((player) => (
                  <Link href={`/players/${player.id}`} key={player.id} className="result-card">
                    <div className="result-type">{t("players").toUpperCase()}</div>
                    <h4>{player.display_name || t("hoopCheckPlayer")} {player.player_verified && <VerifiedBadge label={t("verifiedPlayer")} />}</h4>
                    <p>
                      {[
                        player.player_position,
                        player.years_pro ? `${player.years_pro} years pro` : null,
                        player.current_team,
                        player.current_country || player.country,
                      ].filter(Boolean).join(" · ") || t("professionalProfile")}
                    </p>
                    <span className="result-link">{t("viewPlayerProfile")}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!loading && !error && visibleCoaches.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><span>02</span><h3>{t("coaches")}</h3></div>
              <div className="result-grid">
                {visibleCoaches.map((coach) => (
                  <Link href={`/coaches/${coach.id}`} key={coach.id} className="result-card">
                    <div className="result-type">{t("coaches").toUpperCase()}</div>
                    <h4>{coach.name}</h4>
                    <p>{coach.city && coach.country ? `${coach.city}, ${coach.country}` : coach.country || coach.city || t("locationUnavailable")}</p>
                    <span className="result-link">{t("researchCoach")}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!loading && !error && visibleTeams.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><span>03</span><h3>{t("mensTeams")}</h3></div>
              <div className="result-grid">
                {visibleTeams.map((team) => (
                  <TeamDirectoryRow key={team.id} id={team.id} name={team.name} city={team.city} country={team.country} leagueName={team.league_name} href={`/teams/${team.id}`} kind="mens" />
                ))}
              </div>
            </section>
          )}

          {!loading && !error && visibleWomensTeams.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><span>04</span><h3>{t("womensTeams")}</h3></div>
              <div className="result-grid">
                {visibleWomensTeams.map((team) => (
                  <TeamDirectoryRow key={team.id} id={team.id} name={team.name} city={team.city} country={team.country} leagueName={team.league_name} href={`/womens/${team.id}`} kind="womens" />
                ))}
              </div>
            </section>
          )}

          {!loading && !error && visibleLeagues.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><span>05</span><h3>{t("leagues")}</h3></div>
              <div className="result-grid">
                {visibleLeagues.map((league) => (
                  <Link href={`/leagues/${league.id}`} key={league.id} className="result-card">
                    <div className="result-type">{t("leagues").toUpperCase()}</div>
                    <h4>{league.name}</h4>
                    <p>{league.country || t("countryUnavailable")}</p>
                    {league.level && <div className="result-meta">{t("level")}: {league.level}</div>}
                    <span className="result-link">{t("researchLeague")}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </section>
      )}

      {!query && (
        <Surface as="section" className="empty-section">
          <div className="eyebrow">{t("startResearching")}</div>
          <h2>{t("searchBeforeSign")}</h2>
          <div className="quick-links">
            <Link href="/coaches" className="quick-card"><span>01</span><strong>{t("browseCoaches")}</strong><small>{t("researchPlayerExperiences")}</small></Link>
            <Link href="/teams" className="quick-card"><span>02</span><strong>{t("browseTeams")}</strong><small>{t("exploreProfessionalOrganizations")}</small></Link>
            <Link href="/leagues" className="quick-card"><span>03</span><strong>{t("browseLeagues")}</strong><small>{t("exploreLeaguesWorldwide")}</small></Link>
          </div>
        </Surface>
      )}
    </main>
  );
}

export default function SearchPage() {
  const { t } = useLanguage();
  return (
    <Suspense fallback={<main className="search-page hc-global-search-page"><section className="search-hero"><p className="eyebrow">{t("globalResearch")}</p><h1>{t("loading")}</h1><p>{t("preparingSearchResults")}</p></section></main>}>
      <SearchContent />
    </Suspense>
  );
}
