"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import FanBasketballSideSwitch from "../../components/FanBasketballSideSwitch";
import { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import PlayerContactButton from "../../components/PlayerContactButton";
import FollowButton from "../../components/FollowButton";
import { VerifiedBadge } from "../../components/HoopCheckUI";
import HoopLoading from "../../components/HoopLoading";
import SearchBar from "../../components/SearchBar";
import TeamDirectoryRow from "../../components/TeamDirectoryRow";
import Surface from "../../components/Surface";
import { useLanguage, type Language } from "../../components/LanguageProvider";

const singleResultLabel: Record<Language, string> = {
  en: "result", es: "resultado", fr: "résultat", de: "Ergebnis", tr: "sonuç",
  pt: "resultado", it: "risultato", el: "αποτέλεσμα", ar: "نتيجة", ru: "результат",
  az: "nəticə", pl: "wynik", zh: "条结果", ja: "件の結果", sr: "rezultat",
  fi: "tulos", he: "תוצאה", lt: "rezultatas", uk: "результат",
};

type Coach = { id: string; name: string; country: string | null; city: string | null };
type Team = { id: string; name: string; country: string | null; city: string | null; league_name: string | null; logo_url?: string | null; logo_bg?: "transparent" | "light" | "dark" | null };
type WomensTeam = { id: string; name: string; country: string | null; city: string | null; league_name: string | null; logo_url?: string | null; logo_bg?: "transparent" | "light" | "dark" | null };
type League = { id: string; name: string; country: string | null; level: string | null };
type SocialSuggestion = { entity_type: "player" | "team"; entity_id: string; display_name: string; avatar_url: string | null; detail: string | null; player_verified: boolean };
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

function SearchContent() {
  const { language, t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q")?.trim() || "";
  const initialType = searchParams.get("type");
  const basketballSide = useFanBasketballSide();
  const [isFanAccount, setIsFanAccount] = useState<boolean | null>(null);
  const [roleReady, setRoleReady] = useState(false);
  const [suggestions, setSuggestions] = useState<SocialSuggestion[]>([]);
  useEffect(() => { let active = true; void (async () => { try { const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const [{ data }, { data: graphSuggestions }] = await Promise.all([supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle(), supabase.rpc("get_social_suggestions")]); if (!active) return; const fan = data?.account_type ? data.account_type === "fan" : null; setIsFanAccount(fan); setSuggestions(((graphSuggestions || []) as SocialSuggestion[]).filter(item => fan === false || item.entity_type === "team")); } catch (error) { console.error("Unable to load search role context:", error); if (active) setIsFanAccount(null); } finally { if (active) setRoleReady(true); } })(); return () => { active = false; }; }, []);

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [womensTeams, setWomensTeams] = useState<WomensTeam[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState(query);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [signedInViewer, setSignedInViewer] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({data}) => {
      if (!active) return;
      setSignedInViewer(Boolean(data.user));
      if (data.user) {
        try { setRecentSearches(JSON.parse(localStorage.getItem("hc-recent-searches") || "[]").filter((x: unknown) => typeof x === "string").slice(0,5)); } catch { setRecentSearches([]); }
      }
    });
    return () => { active = false; };
  }, []);
  const rememberSearch = (term: string) => {
    const value = term.trim();
    if (!value || !signedInViewer) return;
    setRecentSearches(previous => {
      const next = [value, ...previous.filter(x => x.toLowerCase() !== value.toLowerCase())].slice(0,5);
      localStorage.setItem("hc-recent-searches", JSON.stringify(next));
      return next;
    });
  };
  const removeRecent = (term: string) => setRecentSearches(previous => {
    const next = previous.filter(x => x !== term);
    localStorage.setItem("hc-recent-searches", JSON.stringify(next));
    return next;
  });
  const [typeFilter, setTypeFilter] = useState<"all" | "players" | "coaches" | "mens-teams" | "womens-teams" | "leagues">(
    initialType === "players" || initialType === "coaches" || initialType === "mens-teams" || initialType === "womens-teams" || initialType === "leagues" ? initialType : "all"
  );
  const [countryFilter, setCountryFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [desktopAutofocus, setDesktopAutofocus] = useState(false);
  useEffect(() => { setDesktopAutofocus(window.matchMedia("(min-width: 768px)").matches); }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSuggestionsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let active = true;

    async function search() {
      if (!query) {
        if (!active) return;
        setCoaches([]);
        setTeams([]);
        setWomensTeams([]);
        setLeagues([]);
        setPlayers([]);
        setLoading(false);
        setError("");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const searchTerm = `%${query.replace(/[,%()]/g, " ")}%`;
        const wantsPlayers = roleReady && isFanAccount === false && (typeFilter === "all" || typeFilter === "players");
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
                let request = supabase.from("teams").select("id, name, country, city, league_name, logo_url, logo_bg")
                  .eq("basketball_type", "mens")
                  .or(`name.ilike.${searchTerm},country.ilike.${searchTerm},city.ilike.${searchTerm},league_name.ilike.${searchTerm}`)
                  .order("name").limit(30);
                if (countryFilter) request = request.eq("country", countryFilter);
                return request;
              })()
            : Promise.resolve({ data: [], error: null }),
          wantsWomensTeams
            ? (() => {
                let request = supabase.from("womens_teams").select("id, name, country, city, league_name, logo_url, logo_bg")
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

        if (!active) return;
        const failures = [playerResult, coachResult, teamResult, womensTeamResult, leagueResult].filter(result => result.error);
        if (failures.length) {
          console.error("Some search categories failed:", failures.map(result => result.error));
          setError("Some directories are temporarily unavailable. Available results are shown below; try another category or search again.");
        }
        setPlayers((playerResult.error ? [] : playerResult.data || []) as Player[]);
        setCoaches(coachResult.error ? [] : coachResult.data || []);
        setTeams(teamResult.error ? [] : teamResult.data || []);
        setWomensTeams(womensTeamResult.error ? [] : womensTeamResult.data || []);
        setLeagues(leagueResult.error ? [] : leagueResult.data || []);
      } catch (err) {
        console.error(err);
        if (active) setError("Something went wrong while searching. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void search();
    return () => { active = false; };
  }, [query, countryFilter, verifiedOnly, typeFilter, roleReady, isFanAccount]);

  useEffect(() => { setSearchInput(query); }, [query]);

  // Debounce URL-backed search so typing issues one server query per pause,
  // while retaining the previous result set until the new query resolves.
  useEffect(() => {
    const nextQuery = searchInput.trim();
    if (nextQuery === query) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (nextQuery) params.set("q", nextQuery);
      else params.delete("q");
      const suffix = params.toString();
      router.replace(suffix ? `/search?${suffix}` : "/search", { scroll: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput, query, router]);
  // Sync explicit URL filters without resetting a category the visitor just selected
  // while their account role (or basketball-side preference) is still loading.
  useEffect(() => {
    if (!roleReady) return;
    if (initialType === "players" && isFanAccount === true) { setTypeFilter("all"); return; }
    if (initialType === "players" || initialType === "coaches" || initialType === "mens-teams" || initialType === "womens-teams" || initialType === "leagues") {
      setTypeFilter(initialType);
    }
  }, [initialType, isFanAccount, roleReady]);

  const countries = useMemo(() => Array.from(new Set([
    ...players.map((x) => x.country),
    ...players.map((x) => x.current_country),
    ...coaches.map((x) => x.country),
    ...teams.map((x) => x.country),
    ...womensTeams.map((x) => x.country),
    ...leagues.map((x) => x.country),
  ].filter(Boolean) as string[])).sort(), [players, coaches, teams, womensTeams, leagues]);

  const visiblePlayers = roleReady && isFanAccount === false && (typeFilter === "all" || typeFilter === "players")
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

  const suggestionTargets = [
    ...visibleTeams.slice(0,3).map(x=>"/teams/"+x.id),
    ...visibleWomensTeams.slice(0,3).map(x=>"/womens/"+x.id),
    ...visiblePlayers.slice(0,3).map(x=>"/players/"+x.id),
    ...visibleCoaches.slice(0,2).map(x=>"/coaches/"+x.id),
    ...visibleLeagues.slice(0,2).map(x=>"/leagues/"+x.id)
  ];
  const totalResults = (roleReady && isFanAccount === false ? visiblePlayers.length : 0) + visibleCoaches.length + visibleTeams.length + visibleWomensTeams.length + visibleLeagues.length;

  return (
    <main className="search-page hc-global-search-page">
      <FanBasketballSideSwitch />
      <section className="hc-search-compact-bar" style={{ position: "sticky", top: "var(--header-height, 64px)", zIndex: 20, padding: "8px 0", background: "var(--background, transparent)" }}>
        

        <SearchBar
          className="search-form"
          hideSubmit
          autoFocus={desktopAutofocus}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              if (!suggestionsOpen || !suggestionTargets.length) return;
              event.preventDefault();
              setActiveSuggestion(previous => event.key === "ArrowDown" ? (previous + 1) % suggestionTargets.length : (previous + suggestionTargets.length - 1) % suggestionTargets.length);
            }
            if (event.key === "Enter" && activeSuggestion >= 0 && suggestionTargets[activeSuggestion]) {
              event.preventDefault();
              rememberSearch(searchInput);
              router.push(suggestionTargets[activeSuggestion]);
            }
          }
          onSubmit={(value) => { rememberSearch(value); router.push("/search?q=" + encodeURIComponent(value)); }}

          name="q"
          value={searchInput}
          onChange={(value) => { setSearchInput(value); setSuggestionsOpen(true); setActiveSuggestion(-1); }}
          placeholder={!roleReady || isFanAccount ? t("searchBasketballWorld") : t("searchPeoplePlaceholder")}
          ariaLabel={!roleReady || isFanAccount ? t("searchBasketballWorld") : t("searchPeoplePlaceholder")}
        />
      </section>
      {suggestionsOpen && searchInput.trim() && <button type="button" onClick={()=>setSuggestionsOpen(false)} style={{fontSize:12,marginBottom:6}}>Close suggestions (Esc)</button>}
      <div className="hc-search-type-chips" role="group" aria-label="Search categories" style={{display:"flex",gap:8,flexWrap:"wrap",padding:"8px 0 12px"}}>
        {(["all","mens-teams","players","coaches","leagues"] as const).filter(type=>type!=="players"||isFanAccount===false).map(type=><button key={type} type="button" className="btn dark" aria-pressed={typeFilter===type} onClick={()=>setTypeFilter(type)}>{type==="all"?"All":type==="mens-teams"?"Teams":type==="players"?"Players":type==="coaches"?"Coaches":"Leagues"}</button>)}
      </div>
      {suggestionsOpen && searchInput.trim() && searchInput.trim() === query && !loading && totalResults > 0 && <section id="hc-search-suggestions" className="hc-search-suggestions" aria-label="Search suggestions" aria-live="polite" style={{padding:12,border:"1px solid var(--border)",borderRadius:16,marginBottom:12}}>
        {visibleTeams.slice(0,3).map(team=><Link key={"team-"+team.id} href={`/teams/${team.id}`} style={{display:"block",padding:8}}>{team.name} · {team.country}</Link>)}
        {visibleWomensTeams.slice(0,3).map(team=><Link key={"women-"+team.id} href={`/womens/${team.id}`} style={{display:"block",padding:8}}>{team.name} · {team.country}</Link>)}
        {visiblePlayers.slice(0,3).map(player=><Link key={"player-"+player.id} href={`/players/${player.id}`} style={{display:"block",padding:8}}>{player.display_name || "Player"} · {player.current_team || ""}</Link>)}
        {visibleCoaches.slice(0,2).map(coach=><Link key={"coach-"+coach.id} href={`/coaches/${coach.id}`} style={{display:"block",padding:8}}>{coach.name}</Link>)}
        {visibleLeagues.slice(0,2).map(league=><Link key={"league-"+league.id} href={`/leagues/${league.id}`} style={{display:"block",padding:8}}>{league.name}</Link>)}
        <a href="#search-full-results" onClick={()=>setSuggestionsOpen(false)} style={{display:"block",padding:8,fontWeight:700}}>See all results for &quot;{query}&quot; →</a>
      </section>}
      {!query && signedInViewer && recentSearches.length > 0 && <section aria-label="Recent searches" style={{padding:"8px 0 12px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><strong>RECENT</strong><button type="button" onClick={()=>{setRecentSearches([]);localStorage.removeItem("hc-recent-searches");}}>Clear all</button></div>{recentSearches.map(term=><div key={term} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:8}}><button type="button" onClick={()=>setSearchInput(term)}>{term}</button><button type="button" aria-label={"Remove "+term} onClick={()=>removeRecent(term)}>×</button></div>)}</section>}
      <nav className="hc-directory-switcher hc-liquid-glass-search-switcher" aria-label={t("browseDirectoriesLabel")}>
        <span className="hc-directory-switcher-label">{t("browseDirectoriesLabel")}</span>
        <Link href="/teams">{t("mensTeams")}</Link>
        <Link href="/womens">{t("womensTeams")}</Link>
        <Link href="/coaches">{t("coaches")}</Link>
        <Link href="/leagues">{t("leagues")}</Link>
        {roleReady && isFanAccount === false && <Link href="/players">{t("players")}</Link>}
        <Link href="/search">{t("globalSearch")}</Link>
        </nav>


      {roleReady && !query && suggestions.length > 0 && (
        <section className="hc-suggested-for-you" aria-label="Suggested for you">
          <div className="group-heading"><span>HC</span><h2>Suggested for you</h2></div>
          <div className="hc-suggested-row">
            {suggestions.map((item) => <Link key={item.entity_type + item.entity_id} href={item.entity_type === "team" ? "/teams/" + item.entity_id : "/players/" + item.entity_id} className="hc-suggested-card">
              {item.avatar_url ? <img src={item.avatar_url} alt="" /> : <span className="hc-suggested-avatar">{(item.display_name || "HC").slice(0,1).toUpperCase()}</span>}
              <strong>{item.display_name} {item.player_verified && <VerifiedBadge label="Verified player" />}</strong>
              <small>{item.entity_type === "team" ? "Team" : "Player"} · {item.detail}</small>
            </Link>)}
          </div>
        </section>
      )}




      {query && (
        <section id="search-full-results" className="results-section">
          <div className="results-header">
            <div>
              <div className="eyebrow">{t("searchResults")}</div>
              <h2>{t("resultsFor")} &quot;{query}&quot;</h2>
            </div>
            {!loading && <div className="result-count">{totalResults} {totalResults === 1 ? singleResultLabel[language] : t("resultCount")}</div>}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} aria-label={t("country")} style={{ padding: "10px 14px", borderRadius: 8 }}>
                <option value="">{t("allCountries")}</option>
                {countries.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
              <button type="button" className="btn dark" onClick={() => setVerifiedOnly((value) => !value)} aria-pressed={verifiedOnly}>
                {verifiedOnly ? <><VerifiedBadge label={t("verifiedFilterActive")} /> {t("verifiedOnly")}</> : t("verifiedOnly")}
              </button>
            </div>

          {loading && <HoopLoading variant="inline" label={t("searchingHoopCheck")} />}
          {error && <div className="state-card error"><p>{error}</p></div>}

          {!loading && !error && totalResults === 0 && (
            <div className="state-card">
              <div className="eyebrow">{t("noMatches")}</div>
              <h3>{t("nothingFound")}</h3>
              <p>{t("tryDifferentSearch")}</p>
            </div>
          }

          {!loading && visiblePlayers.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><span>01</span><h3>{t("players")}</h3></div>
              <div className="result-grid">
                {visiblePlayers.map((player) => (
                  <article className="result-card" key={player.id}>
                    <Link href={`/players/${player.id}`} className="hc-search-player-result">
                      <div className="result-type">{t("players").toUpperCase()}</div>
                      <h4>{player.display_name || t("hoopCheckPlayer")} {player.player_verified && <VerifiedBadge label={t("verifiedPlayer")} />}</h4>
                      <p>{[player.player_position, player.years_pro ? `${player.years_pro} years pro` : null, player.current_team, player.current_country || player.country].filter(Boolean).join(" · ") || t("professionalProfile")}</p>
                      <span className="result-link">{t("viewPlayerProfile")}</span>
                    </Link>
                    <FollowButton targetType="player" targetId={player.id} showNotifications={false} />
                    {roleReady && isFanAccount === false && <PlayerContactButton playerId={player.id} compact />}
                  </article>
                ))}
              </div>
            </section>
          )}

          {!loading && visibleCoaches.length > 0 && (
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

          {!loading && visibleTeams.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><span>03</span><h3>{t("mensTeams")}</h3></div>
              <div className="result-grid">
                {visibleTeams.map((team) => (
                  <TeamDirectoryRow key={team.id} id={team.id} name={team.name} city={team.city} country={team.country} leagueName={team.league_name} href={`/teams/${team.id}`} kind="mens" fanView={!roleReady || isFanAccount} logoUrl={team.logo_url} logoBg={team.logo_bg} />
                ))}
              </div>
            </section>
          )}

          {!loading && visibleWomensTeams.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><span>04</span><h3>{t("womensTeams")}</h3></div>
              <div className="result-grid">
                {visibleWomensTeams.map((team) => (
                  <TeamDirectoryRow key={team.id} id={team.id} name={team.name} city={team.city} country={team.country} leagueName={team.league_name} href={`/womens/${team.id}`} kind="womens" fanView={isFanAccount} logoUrl={team.logo_url} logoBg={team.logo_bg} />
                ))}
              </div>
            </section>
          )}

          {!loading && visibleLeagues.length > 0 && (
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
            <Link href="/coaches" className="quick-card"><span>01</span><strong>{t("browseCoaches")}</strong><small>{!roleReady || isFanAccount ? t("researchCoach") : t("researchPlayerExperiences")}</small></Link>
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
    <Suspense fallback={<HoopLoading label={t("preparingSearchResults")} />}>
      <SearchContent />
    </Suspense>
  );
}
