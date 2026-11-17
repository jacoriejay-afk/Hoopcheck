"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import FanBasketballSideSwitch from "../../components/FanBasketballSideSwitch";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import PlayerContactButton from "../../components/PlayerContactButton";
import FollowButton from "../../components/FollowButton";
import { VerifiedBadge } from "../../components/HoopCheckUI";
import HoopLoading from "../../components/HoopLoading";
import { useAuthState } from "../../components/AuthProvider";
import "./search.css";
import TeamDirectoryRow from "../../components/TeamDirectoryRow";
import { useLanguage, type Language } from "../../components/LanguageProvider";

const singleResultLabel: Record<Language, string> = {
  en: "result", es: "resultado", fr: "résultat", de: "Ergebnis", tr: "sonuç",
  pt: "resultado", it: "risultato", el: "αποτέλεσμα", ar: "نتيجة", ru: "результат",
  az: "nəticə", pl: "wynik", zh: "条结果", ja: "件の結果", sr: "rezultat",
  fi: "tulos", he: "תוצאה", lt: "rezultatas", uk: "результат",
};

const pageSize = 12;

type DirectoryOverview = {
  mens: number;
  womens: number;
  coaches: number;
  leagues: number;
  countries: { country: string; total: number }[];
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
  username?: string;
};

function SearchContent() {
  const { language, t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q")?.trim() || "";
  const initialType = searchParams.get("type");
  const countryFilter = searchParams.get("country") || "";
  const requestedPage = Number(searchParams.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1000) : 1;
  const offset = (page - 1) * pageSize;
  const { userId } = useAuthState();
  const [roleContext, setRoleContext] = useState<{
    userId: string;
    accountType: string | null;
    suggestions: SocialSuggestion[];
  } | null>(null);
  const currentRole = roleContext?.userId === userId ? roleContext : null;
  const isFanAccount = currentRole?.accountType === "fan";
  const roleReady = !userId || currentRole !== null;
  const suggestions = currentRole?.suggestions ?? [];
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void Promise.all([
      supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle(),
      supabase.rpc("get_social_suggestions"),
    ]).then(([profile, graph]) => {
      if (!active) return;
      const accountType = profile.data?.account_type ?? null;
      const items = (graph.data ?? []) as SocialSuggestion[];
      setRoleContext({
        userId,
        accountType,
        suggestions: items.filter(item => item.entity_type === "team" || (accountType && accountType !== "fan")),
      });
    }, () => {
      if (active) setRoleContext({ userId, accountType: null, suggestions: [] });
    });
    return () => { active = false; };
  }, [userId]);

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [womensTeams, setWomensTeams] = useState<WomensTeam[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState(query);
  const typeFilter = (initialType === "players" && !isFanAccount) || initialType === "coaches"
    || initialType === "mens-teams" || initialType === "womens-teams" || initialType === "leagues" ? initialType : "all";
  const [hasMore, setHasMore] = useState(false);
  const [overview, setOverview] = useState<DirectoryOverview | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.rpc("search_directory_overview").then(({ data, error }) => {
      if (active && !error && data && Array.isArray(data.countries)) setOverview(data as DirectoryOverview);
    });
    return () => { active = false; };
  }, []);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [settledQuery, setSettledQuery] = useState("");
  const [recent, setRecent] = useState<{ userId: string; queries: string[] } | null>(null);
  const recentQueries = recent?.userId === userId ? recent?.queries ?? [] : [];
  useEffect(() => {
    if (!userId) return;
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(`hc-search-history:${userId}`) ?? "[]");
      if (Array.isArray(saved)) {
        setRecent({ userId, queries: saved.filter((value): value is string => typeof value === "string").slice(0, 5) });
      }
    } catch {}
  }, [userId]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia("(min-width: 900px) and (pointer: fine)").matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
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
        setHasMore(false);
        setError("");
        return;
      }

      setLoading(true);
      setHasMore(false);
      setError("");

      try {
        const normalizedQuery = query.replace(/[,%"()\\*]/g, " ").trim();
        const username = /^@[a-z0-9_]{3,20}$/i.test(query) ? query.slice(1).toLowerCase() : null;
        const searchTerm = `%${normalizedQuery.replace(/_/g, " ")}%`;
        if (!normalizedQuery) {
          setPlayers([]);
          setCoaches([]);
          setTeams([]);
          setWomensTeams([]);
          setLeagues([]);
          return;
        }
        const wantsPlayers = roleReady && !isFanAccount && (typeFilter === "all" || typeFilter === "players");
        const wantsCoaches = !username && (typeFilter === "all" || typeFilter === "coaches");
        const wantsMensTeams = !username && (typeFilter === "all" || typeFilter === "mens-teams");
        const wantsWomensTeams = !username && (typeFilter === "all" || typeFilter === "womens-teams");
        const wantsLeagues = !username && (typeFilter === "all" || typeFilter === "leagues");

        const [playerResult, coachResult, teamResult, womensTeamResult, leagueResult, usernameResult] = await Promise.all([
          wantsPlayers && !username
            ? supabase.rpc("search_public_players_page", {
                p_query: normalizedQuery,
                p_country: countryFilter,
                p_position: "",
                p_verified_only: verifiedOnly,
                p_limit: pageSize + 1,
                p_offset: offset,
              })
            : Promise.resolve({ data: [], error: null }),
          wantsCoaches
            ? (() => {
                let request = supabase.from("coaches").select("id, name, country, city")
                  .or(`name.ilike.${searchTerm},country.ilike.${searchTerm},city.ilike.${searchTerm}`)
                  .order("name").order("id").range(offset, offset + pageSize);
                if (countryFilter) request = request.eq("country", countryFilter);
                return request;
              })()
            : Promise.resolve({ data: [], error: null }),
          wantsMensTeams
            ? (() => {
                let request = supabase.from("teams").select("id, name, country, city, league_name, logo_url, logo_bg")
                  .eq("basketball_type", "mens")
                  .eq("active", true)
                  .or(`name.ilike.${searchTerm},country.ilike.${searchTerm},city.ilike.${searchTerm},league_name.ilike.${searchTerm}`)
                  .order("name").order("id").range(offset, offset + pageSize);
                if (countryFilter) request = request.eq("country", countryFilter);
                return request;
              })()
            : Promise.resolve({ data: [], error: null }),
          wantsWomensTeams
            ? (() => {
                let request = supabase.from("womens_teams").select("id, name, country, city, league_name, logo_url, logo_bg")
                  .eq("active", true)
                  .or(`name.ilike.${searchTerm},country.ilike.${searchTerm},city.ilike.${searchTerm},league_name.ilike.${searchTerm}`)
                  .order("name").order("id").range(offset, offset + pageSize);
                if (countryFilter) request = request.eq("country", countryFilter);
                return request;
              })()
            : Promise.resolve({ data: [], error: null }),
          wantsLeagues
            ? (() => {
                let request = supabase.from("leagues").select("id, name, country, level")
                  .or(`name.ilike.${searchTerm},country.ilike.${searchTerm},level.ilike.${searchTerm}`)
                  .order("name").order("id").range(offset, offset + pageSize);
                if (countryFilter) request = request.eq("country", countryFilter);
                return request;
              })()
            : Promise.resolve({ data: [], error: null }),
          wantsPlayers && username && page === 1
            ? supabase.from("profiles")
                .select("id,display_name,username,avatar_url,country,player_position:position,years_pro,current_country,current_team,player_verified")
                .eq("username", username)
                .eq("account_type", "player")
                .eq("profile_visibility", "public")
                .neq("moderation_status", "suspended")
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (!active) return;
        const failures = [playerResult, coachResult, teamResult, womensTeamResult, leagueResult, usernameResult].filter(result => result.error);
        if (failures.length) {
          console.error("Some search categories failed:", failures.map(result => result.error));
          setError("Some directories are temporarily unavailable. Available results are shown below; try another category or search again.");
        }
        const playerMatches = (playerResult.error ? [] : playerResult.data ?? []) as Player[];
        const usernameMatch = usernameResult.data as Player | null;
        const exactPlayer = usernameMatch && (!verifiedOnly || usernameMatch.player_verified) ? usernameMatch : null;
        setHasMore([playerResult, coachResult, teamResult, womensTeamResult, leagueResult]
          .some(result => !result.error && (result.data?.length ?? 0) > pageSize));
        setPlayers(exactPlayer ? [exactPlayer] : playerMatches.slice(0, pageSize));
        setCoaches(coachResult.error ? [] : (coachResult.data ?? []).slice(0, pageSize));
        setTeams(teamResult.error ? [] : (teamResult.data ?? []).slice(0, pageSize));
        setWomensTeams(womensTeamResult.error ? [] : (womensTeamResult.data ?? []).slice(0, pageSize));
        setLeagues(leagueResult.error ? [] : (leagueResult.data ?? []).slice(0, pageSize));
      } catch (err) {
        console.error(err);
        if (active) setError("Something went wrong while searching. Please try again.");
      } finally {
        if (active) {
          setLoading(false);
          setSettledQuery(query);
        }
      }
    }

    void search();
    return () => { active = false; };
  }, [query, countryFilter, verifiedOnly, typeFilter, roleReady, isFanAccount, offset, page]);

  useEffect(() => { setSearchInput(query); }, [query]);

  function updateQuery(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("q") !== value) params.delete("page");
    if (!value) params.delete("country");
    if (value) params.set("q", value);
    else params.delete("q");
    const suffix = params.toString();
    window.history.replaceState(null, "", suffix ? `/search?${suffix}` : "/search");
  }

  useEffect(() => {
    const nextQuery = searchInput.trim();
    if (nextQuery === query) return;
    const timer = window.setTimeout(() => updateQuery(nextQuery), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput, query]);

  const countries = useMemo(() => Array.from(new Set([
    ...(overview?.countries.map(item => item.country) ?? []),
    ...players.map((x) => x.country),
    ...players.map((x) => x.current_country),
    ...coaches.map((x) => x.country),
    ...teams.map((x) => x.country),
    ...womensTeams.map((x) => x.country),
    ...leagues.map((x) => x.country),
    countryFilter,
  ].filter(Boolean) as string[])).sort(), [players, coaches, teams, womensTeams, leagues, countryFilter, overview]);

  const visiblePlayers = roleReady && !isFanAccount && (typeFilter === "all" || typeFilter === "players")
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

  const totalResults = (roleReady && !isFanAccount ? visiblePlayers.length : 0) + visibleCoaches.length + visibleTeams.length + visibleWomensTeams.length + visibleLeagues.length;

  const directoryLinks = [
    { href: "/teams", label: t("mensTeams"), count: overview?.mens },
    { href: "/womens", label: t("womensTeams"), count: overview?.womens },
    ...(roleReady && !isFanAccount ? [{ href: "/players", label: t("players"), count: undefined }] : []),
    { href: "/coaches", label: t("coaches"), count: overview?.coaches },
    { href: "/leagues", label: t("leagues"), count: overview?.leagues },
  ];
  const suggestionGroups = [
    { label: t("teams"), rows: [
      ...visibleTeams.map(team => ({ href: `/teams/${team.id}`, title: team.name, detail: team.country })),
      ...visibleWomensTeams.map(team => ({ href: `/womens/${team.id}`, title: team.name, detail: team.country })),
    ].slice(0, 3) },
    { label: t("players"), rows: visiblePlayers.slice(0, 3).map(player => ({
      href: `/players/${player.id}`, title: player.display_name || t("hoopCheckPlayer"),
      detail: player.username ? `@${player.username}` : player.current_team,
    })) },
    { label: t("coaches"), rows: visibleCoaches.slice(0, 2).map(coach => ({
      href: `/coaches/${coach.id}`, title: coach.name, detail: coach.country,
    })) },
    { label: t("leagues"), rows: visibleLeagues.slice(0, 2).map(league => ({
      href: `/leagues/${league.id}`, title: league.name, detail: league.country,
    })) },
  ].filter(group => group.rows.length > 0);
  const rows = suggestionGroups.flatMap(group => group.rows);
  const showDropdown = suggestionsOpen && !!query && query === searchInput.trim()
    && query === settledQuery && !loading && rows.length > 0;
  const activeSuggestion = showDropdown ? rows[selectedSuggestion] : undefined;
  const activeOptionId = activeSuggestion ? `search-option-${selectedSuggestion}` : undefined;

  function updateSearchParams(changes: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);
    for (const [name, value] of Object.entries(changes)) {
      if (value) params.set(name, value);
      else params.delete(name);
    }
    const suffix = params.toString();
    window.history.pushState(null, "", suffix ? `/search?${suffix}` : "/search");
  }

  const numberFormat = new Intl.NumberFormat(language);

  function saveRecent(queries: string[]) {
    if (!userId) return;
    setRecent({ userId, queries });
    try { window.localStorage.setItem(`hc-search-history:${userId}`, JSON.stringify(queries)); } catch {}
  }

  function rememberQuery() {
    const value = searchInput.trim();
    if (value) saveRecent([value, ...recentQueries.filter(item => item.toLowerCase() !== value.toLowerCase())].slice(0, 5));
  }

  function showResults() {
    rememberQuery();
    setSuggestionsOpen(false);
    setSelectedSuggestion(-1);
    updateQuery(searchInput.trim());
  }

  return (
    <main className="search-page hc-global-search-page">
      <header className="hc-discovery-heading"><h1>{t("search")}</h1></header>
      <div className="hc-live-search">
        <form role="search" className="hc-live-search__form" onSubmit={event => {
          event.preventDefault();
          if (activeSuggestion) {
            rememberQuery();
            router.push(activeSuggestion.href);
          }
          else showResults();
        }} onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSuggestionsOpen(false);
        }}>
          <div className="hc-live-search__field">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.2 4.2" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-label={t("globalSearch")}
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              aria-controls={showDropdown ? "search-suggestions" : undefined}
              aria-activedescendant={activeOptionId}
              autoComplete="off"
              maxLength={120}
              value={searchInput}
              onClick={() => setSuggestionsOpen(true)}
              onChange={event => {
                setSearchInput(event.target.value);
                setSelectedSuggestion(-1);
                setSuggestionsOpen(true);
              }}
              onKeyDown={event => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setSuggestionsOpen(false);
                  setSelectedSuggestion(-1);
                }
                if ((event.key === "ArrowDown" || event.key === "ArrowUp") && rows.length) {
                  event.preventDefault();
                  setSuggestionsOpen(true);
                  setSelectedSuggestion(index => event.key === "ArrowDown"
                    ? (index + 1) % rows.length
                    : index <= 0 ? rows.length - 1 : index - 1);
                }
              }}
              placeholder={roleReady && !isFanAccount ? t("searchPeoplePlaceholder") : t("searchBasketballWorld")}
            />
            {searchInput && <button type="button" aria-label="Clear search" onClick={() => {
              setSearchInput("");
              setSelectedSuggestion(-1);
              updateQuery("");
              inputRef.current?.focus();
            }}>×</button>}
          </div>
          {showDropdown && <div className="hc-live-search__dropdown">
            <div id="search-suggestions" role="listbox" aria-label={t("searchResults")}>
              {suggestionGroups.map(group => <div key={group.label} role="group" aria-label={group.label}>
                <strong className="hc-live-search__label">{group.label}</strong>
                {group.rows.map(row => {
                  const index = rows.indexOf(row);
                  return <Link key={row.href} id={`search-option-${index}`} href={row.href}
                    role="option" aria-selected={index === selectedSuggestion} tabIndex={-1}
                    onMouseDown={event => event.preventDefault()} onClick={rememberQuery}>
                    <span>{row.title}</span>{row.detail && <small>{row.detail}</small>}
                  </Link>;
                })}
              </div>)}
            </div>
            <button className="hc-live-search__all" type="button" onClick={showResults}>See all results</button>
          </div>}
        </form>
      </div>
      {!query && <nav className="hc-search-browse" aria-label={t("browseDirectoriesLabel")}>
        <h2>{t("browseDirectoriesLabel")}</h2>
        <div>{directoryLinks.map(link => <Link key={link.href} href={link.href}><span className="hc-directory-tile-label">{link.label}</span>{link.count != null && <small>{numberFormat.format(link.count)}</small>}<span aria-hidden="true">↗︎</span></Link>)}</div>
      </nav>}
      {!query && Boolean(overview?.countries.length) && <section className="hc-search-recent">
        <h2>{language === "es" ? "Países con más equipos" : "Countries with the most teams"}</h2>
        <ul>{overview?.countries.map(({ country, total }) => <li key={country}>
          <Link href={`/search?${new URLSearchParams({ q: country, country })}`}>
            {country} <small>{numberFormat.format(total)}</small>
          </Link>
        </li>)}</ul>
      </section>}
      {!query && recentQueries.length > 0 && <section className="hc-search-recent">
        <h2>{language === "es" ? "Búsquedas recientes" : "Recent searches"}</h2>
        <ul>{recentQueries.map(item => <li key={item}>
          <button type="button" onClick={() => {
            setSearchInput(item);
            setSelectedSuggestion(-1);
            updateQuery(item);
          }}>{item}</button>
          <button type="button" aria-label={`Remove ${item}`} onClick={() => saveRecent(recentQueries.filter(value => value !== item))}>×</button>
        </li>)}</ul>
      </section>}
      {!query && <FanBasketballSideSwitch />}

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
        <section className="results-section">
          <div className="results-header">
            <div>
              <div className="eyebrow">{t("searchResults")}</div>
              <h2>{t("resultsFor")} &quot;{query}&quot;</h2>
            </div>
            {!loading && <div className="result-count">{numberFormat.format(totalResults)} {totalResults === 1 ? singleResultLabel[language] : t("resultCount")}{(page > 1 || hasMore) && (language === "es" ? " en esta página" : " on this page")}</div>}
          </div>

          {(
            <div className="hc-search-results-filters">
              {(roleReady && !isFanAccount ? (["all", "players", "coaches", "mens-teams", "womens-teams", "leagues"] as const) : (["all", "coaches", "mens-teams", "womens-teams", "leagues"] as const)).map((type) => (
                <button
                  key={type}
                  type="button"
                  className="hc-discovery-filter"
                  onClick={() => updateSearchParams({ type: type === "all" ? "" : type, page: "" })}
                  aria-pressed={typeFilter === type}
                >
                  {type === "all" ? t("all") : type === "mens-teams" ? t("mensTeams") : type === "womens-teams" ? t("womensTeams") : type === "players" ? t("players") : type === "coaches" ? t("coaches") : t("leagues")}
                </button>
              ))}
              <select value={countryFilter} onChange={(e) => updateSearchParams({ country: e.target.value, page: "" })} aria-label={t("country")}>
                <option value="">{t("allCountries")}</option>
                {countries.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
              <button type="button" className="hc-discovery-filter" onClick={() => { setVerifiedOnly(value => !value); updateSearchParams({ page: "" }); }} aria-pressed={verifiedOnly}>
                {verifiedOnly ? <><VerifiedBadge label={t("verifiedFilterActive")} /> {t("verifiedOnly")}</> : t("verifiedOnly")}
              </button>
            </div>
          )}

          {loading && <HoopLoading variant="inline" label={t("searchingHoopCheck")} />}
          {error && <div className="state-card error"><p>{error}</p></div>}

          {!loading && !error && totalResults === 0 && (
            <div className="state-card">
              <div className="eyebrow">{t("noMatches")}</div>
              <h3>{t("nothingFound")}</h3>
              <p>{t("tryDifferentSearch")}</p>
            </div>
          )}

          {!loading && visiblePlayers.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><h3>{t("players")}</h3></div>
              <div className="result-grid">
                {visiblePlayers.map((player) => (
                  <article className="result-card" key={player.id}>
                    <Link href={`/players/${player.id}`} className="hc-search-player-result">
                      <div className="result-type">{t("players").toUpperCase()}</div>
                      <h4>{player.display_name || t("hoopCheckPlayer")} {player.player_verified && <VerifiedBadge label={t("verifiedPlayer")} />}</h4>
                      <p>{[player.player_position, player.years_pro ? `${player.years_pro} years pro` : null, player.current_team, player.current_country || player.country].filter(Boolean).join(" · ") || t("professionalProfile")}</p>
                      <span className="result-link">{t("viewPlayerProfile")}</span>
                    </Link>
                    {player.username && <p className="muted">@{player.username}</p>}
                    <FollowButton targetType="player" targetId={player.id} showNotifications={false} />
                    {userId && userId !== player.id && <PlayerContactButton playerId={player.id} compact />}
                  </article>
                ))}
              </div>
            </section>
          )}

          {!loading && visibleCoaches.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><h3>{t("coaches")}</h3></div>
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
              <div className="group-heading"><h3>{t("mensTeams")}</h3></div>
              <div className="result-grid">
                {visibleTeams.map((team) => (
                  <TeamDirectoryRow key={team.id} id={team.id} name={team.name} city={team.city} country={team.country} leagueName={team.league_name} href={`/teams/${team.id}`} kind="mens" logoUrl={team.logo_url} logoBg={team.logo_bg} />
                ))}
              </div>
            </section>
          )}

          {!loading && visibleWomensTeams.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><h3>{t("womensTeams")}</h3></div>
              <div className="result-grid">
                {visibleWomensTeams.map((team) => (
                  <TeamDirectoryRow key={team.id} id={team.id} name={team.name} city={team.city} country={team.country} leagueName={team.league_name} href={`/womens/${team.id}`} kind="womens" logoUrl={team.logo_url} logoBg={team.logo_bg} />
                ))}
              </div>
            </section>
          )}

          {!loading && visibleLeagues.length > 0 && (
            <section className="result-group">
              <div className="group-heading"><h3>{t("leagues")}</h3></div>
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
          {!loading && (page > 1 || hasMore) && <nav className="actions" aria-label={language === "es" ? "Páginas de resultados" : "Search result pages"}>
            <button type="button" className="btn dark" disabled={page === 1} onClick={() => updateSearchParams({ page: page > 2 ? String(page - 1) : "" })}>
              {language === "es" ? "Anterior" : "Previous"}
            </button>
            <span aria-live="polite">{language === "es" ? "Página" : "Page"} {numberFormat.format(page)}</span>
            <button type="button" className="btn dark" disabled={!hasMore || page >= 1000} onClick={() => updateSearchParams({ page: String(page + 1) })}>
              {language === "es" ? "Siguiente" : "Next"}
            </button>
          </nav>}
        </section>
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
