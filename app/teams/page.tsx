"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import DirectoryLayout from "../../components/DirectoryLayout";

import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import TeamDirectoryRow from "../../components/TeamDirectoryRow";
import SearchBar from "../../components/SearchBar";
import CourtLines from "../../components/CourtLines";
import TeamMap from "../../components/TeamMap";
import Surface from "../../components/Surface";
import { useLanguage } from "../../components/LanguageProvider";

type Team = {
  id: string;
  name: string;
  country: string | null;
  league_name: string | null;
  league_id: string | null;
  division?: string | null;
  city: string | null;
  logo_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type TrustSummary = { score: number | null; reviewCount: number | null; verifiedReviewCount: number | null; explanation: string | null; averageRating: number | null; tier?: "free" | "pro" | "premium" | "player" | "member"; locked?: boolean };

export default function TeamsPage() {
  const { t } = useLanguage();
  const [teams, setTeams] =
    useState<Team[]>([]);
  const [trustScores, setTrustScores] = useState<Record<string, TrustSummary>>({});
  const [teamCoordinates, setTeamCoordinates] = useState<Record<string, { latitude: number | null; longitude: number | null }>>({});
  const [mapTeams, setMapTeams] = useState<Team[]>([]);
  const [mapTrustScores, setMapTrustScores] = useState<Record<string, TrustSummary>>({});
  const [mapCoordinates, setMapCoordinates] = useState<Record<string, { latitude: number | null; longitude: number | null }>>({});

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [continent, setContinent] = useState("");
  const [league, setLeague] = useState("");
  const [division, setDivision] = useState("");
  const [leagueOptions, setLeagueOptions] = useState<{id:string;name:string;country:string|null;level:string|null}[]>([]);
  const [directoryCountries, setDirectoryCountries] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0); const [requestName,setRequestName]=useState(""); const [requestCountry,setRequestCountry]=useState(""); const [requestCity,setRequestCity]=useState(""); const [requestLeague,setRequestLeague]=useState(""); const [requestMessage,setRequestMessage]=useState(""); const [requestSubmitting,setRequestSubmitting]=useState(false);
  const pageSize = 24;
  const withTimeout = <T,>(promise: PromiseLike<T>, ms = 8000, fallback?: T) => Promise.race([Promise.resolve(promise), new Promise<T>((resolve) => setTimeout(() => resolve(fallback as T), ms))]);

  const CONTINENT_COUNTRIES: Record<string, string[]> = {
    Europe: ["Albania","Andorra","Armenia","Austria","Azerbaijan","Belarus","Belgium","Bosnia and Herzegovina","Bulgaria","Croatia","Cyprus","Czechia","Denmark","Estonia","Finland","France","Georgia","Germany","Greece","Hungary","Iceland","Ireland","Israel","Italy","Kosovo","Latvia","Lithuania","Luxembourg","Malta","Moldova","Montenegro","Netherlands","North Macedonia","Norway","Poland","Portugal","Romania","Russia","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Türkiye","Ukraine","United Kingdom"],
    Asia: ["China","Japan","South Korea","Philippines","India","Indonesia","Lebanon","Jordan","Saudi Arabia","United Arab Emirates","Qatar","Bahrain","Iran","Iraq","Kazakhstan","Uzbekistan","Mongolia","Kyrgyzstan","Tajikistan","Turkmenistan","Afghanistan","Bangladesh","Bhutan","Brunei","Cambodia","Laos","Malaysia","Maldives","Myanmar","Nepal","North Korea","Pakistan","Singapore","Sri Lanka","Taiwan","Vietnam","Palestine"],
    Africa: ["Egypt","Tunisia","Morocco","Algeria","Nigeria","Senegal","South Africa","Angola","Cameroon","Rwanda"],
    North_America: ["United States","Canada","Mexico"],
    South_America: ["Argentina","Brazil","Chile","Colombia","Uruguay","Venezuela","Peru"],
    Oceania: ["Australia","New Zealand","Fiji","Guam","Samoa","American Samoa","New Caledonia","French Polynesia","Papua New Guinea"]
  };
  function countryInContinent(value: string | null, selected: string) {
    if (!selected) return true;
    return CONTINENT_COUNTRIES[selected]?.includes(value || "") ?? false;
  }

  useEffect(() => {
    let active = true;
    void withTimeout<any>(Promise.all([
      supabase.from("leagues").select("id,name,country,level").eq("active", true).order("name").limit(300),
      supabase.from("teams").select("country").eq("active", true).not("country", "is", null).limit(2000),
    ]), 2500, [{data:[],error:new Error("timeout")},{data:[],error:new Error("timeout")}])
      .then(([leagueResult, countryResult]) => {
        if (!active) return;
        setLeagueOptions(leagueResult.data || []);
        setDirectoryCountries(Array.from(new Set(((countryResult.data || []) as Array<{country:string|null}>).map((row) => row.country).filter(Boolean) as string[])).sort());
      })
      .catch((error) => {
        console.error("Could not load team directory filters:", error);
        if (active) {
          setLeagueOptions([]);
          setDirectoryCountries([]);
        }
      });
    return () => { active = false; };
  }, []);

  const countries = directoryCountries;
  const divisions = Array.from(new Set(leagueOptions.map((item) => item.level).filter(Boolean) as string[])).sort();

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      async function loadTeams() {
        setLoading(true);
        try {
          let request = supabase
            .from("teams")
            .select("id, name, country, league_name, league_id, city, logo_url", { count: "exact" })
            .eq("active", true)
            .order("name");

          const term = query.trim();
          if (term) {
            const escaped = term.replace(/[%_]/g, (match) => "\\" + match);
            request = request.or(
              "name.ilike.%" + escaped + "%,country.ilike.%" + escaped +
              "%,city.ilike.%" + escaped + "%,league_name.ilike.%" + escaped + "%"
            );
          }
          if (country) request = request.eq("country", country);
          if (league) request = request.eq("league_id", league);
          if (division) {
            const divisionLeagueIds = leagueOptions.filter((item) => item.level === division).map((item) => item.id);
            request = divisionLeagueIds.length ? request.in("league_id", divisionLeagueIds) : request.eq("league_id", "00000000-0000-0000-0000-000000000000");
          }
          const continentCountries = continent ? CONTINENT_COUNTRIES[continent] || [] : [];
          if (continentCountries.length) request = request.in("country", continentCountries);

          const { data, error, count } = await withTimeout<any>(request.range(
            page * pageSize,
            page * pageSize + pageSize - 1
          ), 2500, { data: [], error: new Error("timeout") });
          if (!active) return;
          if (error) {
            console.error("Error loading teams:", error);
            setTeams([]);
            setHasMore(false);
            setTotalCount(0);
          } else {
            setTeams(data || []);
            setTotalCount(count ?? ((page * pageSize) + (data?.length ?? 0)));
            setHasMore((data?.length ?? 0) === pageSize);
          }
        } catch (error) {
          console.error("Unexpected team directory failure:", error);
          if (active) {
            setTeams([]);
            setHasMore(false);
            setTotalCount(0);
          }
        } finally {
          if (active) setLoading(false);
        }
      }
      void loadTeams();
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, country, continent, league, division, leagueOptions, page]);


  useEffect(() => {
    if (!teams.length) { setTrustScores({}); return; }
    let active = true;
    const ids = teams.map(team => team.id).filter(Boolean);
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/trust-score?entityType=team&entityIds=${ids.map(encodeURIComponent).join(",")}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}, cache: "no-store",
      });
      const payload = response.ok ? await response.json() : null;
      if (active && payload?.scores) setTrustScores(payload.scores as Record<string, TrustSummary>);
    })().catch(() => { if (active) setTrustScores({}); });
    return () => { active = false; };
  }, [teams]);

  useEffect(() => {
    if (!teams.length) { setTeamCoordinates({}); return; }
    let active = true;
    const ids = teams.map(team => team.id).filter(Boolean);
    // Coordinates are optional until the location migration is applied. A
    // missing column must never break the core team directory.
    void supabase.from("teams").select("id,latitude,longitude").in("id", ids)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setTeamCoordinates({}); return; }
        setTeamCoordinates(Object.fromEntries((data || []).map((row: any) => [row.id, {
          latitude: row.latitude == null ? null : Number(row.latitude),
          longitude: row.longitude == null ? null : Number(row.longitude),
        }])));
      }, () => { if (active) setTeamCoordinates({}); });
    return () => { active = false; };
  }, [teams]);

  useEffect(() => {
    if (viewMode !== "map") return;
    let active = true;
    const loadAllMapTeams = async () => {
      const all: Team[] = [];
      for (let offset = 0; offset < 5000; offset += 500) {
        let request = supabase.from("teams")
          .select("id,name,country,league_name,league_id,city,logo_url")
          .eq("active", true).order("name");
        const term = query.trim();
        if (term) {
          const escaped = term.replace(/[%_]/g, (match) => "\\" + match);
          request = request.or("name.ilike.%" + escaped + "%,country.ilike.%" + escaped + "%,city.ilike.%" + escaped + "%,league_name.ilike.%" + escaped + "%");
        }
        if (country) request = request.eq("country", country);
        if (league) request = request.eq("league_id", league);
        if (division) {
          const divisionLeagueIds = leagueOptions.filter(item => item.level === division).map(item => item.id);
          request = divisionLeagueIds.length ? request.in("league_id", divisionLeagueIds) : request.eq("league_id", "00000000-0000-0000-0000-000000000000");
        }
        const continentCountries = continent ? CONTINENT_COUNTRIES[continent] || [] : [];
        if (continentCountries.length) request = request.in("country", continentCountries);
        const { data, error } = await request.range(offset, offset + 499);
        if (!active) return;
        if (error) { setMapTeams([]); return; }
        all.push(...((data || []) as Team[]));
        if (!data || data.length < 500) break;
      }
      if (!active) return;
      setMapTeams(all);
      const ids = all.map(team => team.id).filter(Boolean);
      const summaries: Record<string, TrustSummary> = {};
      for (let offset = 0; offset < ids.length; offset += 100) {
        const batch = ids.slice(offset, offset + 100);
        if (!batch.length) continue;
        const response = await fetch(`/api/trust-score?entityType=team&entityIds=${batch.map(encodeURIComponent).join(",")}`);
        if (!active) return;
        if (response.ok) {
          const payload = await response.json();
          Object.assign(summaries, payload?.scores || {});
        }
      }
      if (active) setMapTrustScores(summaries);
      const { data: coordinates, error: coordinateError } = await supabase.from("teams")
        .select("id,latitude,longitude").in("id", ids);
      if (active) setMapCoordinates(!coordinateError ? Object.fromEntries((coordinates || []).map((row: any) => [row.id, {
        latitude: row.latitude == null ? null : Number(row.latitude),
        longitude: row.longitude == null ? null : Number(row.longitude),
      }])) : {});
    };
    void loadAllMapTeams().catch(() => { if (active) setMapTeams([]); });
    return () => { active = false; };
  }, [viewMode, query, country, continent, league, division, leagueOptions]);

  return (
    <main className="hc-team-directory-page">
      <DirectoryLayout current="teams" />

      <section className="hero">
        <Surface as="div" className="research-search">
          <div className="search-label">{t("directoryTitle")}</div>
          <SearchBar value={query} onChange={(value) => { setQuery(value); setPage(0); }} placeholder={t("searchPeoplePlaceholder")} ariaLabel={t("directoryTitle")} onSubmit={(value) => { setQuery(value); setPage(0); }} />
          <div className="team-filter-row">
            <select value={continent} onChange={(e) => { setContinent(e.target.value); setCountry(""); setPage(0); }} aria-label={t("filterTeamsByContinent")}>
              <option value="">{t("allContinents")}</option>
              {Object.keys(CONTINENT_COUNTRIES).map((item) => <option key={item} value={item}>{({ Europe: t("europe"), Asia: t("asia"), Africa: t("africa"), North_America: t("northAmerica"), South_America: t("southAmerica"), Oceania: t("oceania") } as Record<string, string>)[item] || item.replace("_", " ")}</option>)}
            </select>
            <select value={country} onChange={(e) => { setCountry(e.target.value); setPage(0); }} aria-label={t("filterTeamsByCountry")}>
              <option value="">{t("allCountriesFilter")}</option>
              {countries.filter((item) => countryInContinent(item, continent)).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={league} onChange={(e) => { setLeague(e.target.value); setPage(0); }} aria-label={t("filterTeamsByLeague")}>
              <option value="">{t("allLeagues")}</option>
              {leagueOptions.filter(item => !country || item.country === country).map(item => <option key={item.id} value={item.id}>{item.name}{item.level ? ` — ${item.level}` : ""}</option>)}
            </select>
            <select value={division} onChange={(e) => { setDivision(e.target.value); setPage(0); }} aria-label={t("filterTeamsByDivision")}>
              <option value="">{t("allDivisions")}</option>
              {divisions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </Surface>
      </section>

      <section className="hero" style={{paddingTop:0}}><Surface as="div" className="dashboard-card" style={{border:"1px solid var(--orange)"}}><div className="eyebrow">{t("directoryRequest")}</div><h2>{t("dontSeeYourTeam")}</h2><p className="muted">{t("requestTeamDescription")}</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}><input value={requestName} onChange={e=>setRequestName(e.target.value)} placeholder={t("teamName")} /><input value={requestCountry} onChange={e=>setRequestCountry(e.target.value)} placeholder={t("country")} /><input value={requestCity} onChange={e=>setRequestCity(e.target.value)} placeholder={t("cityOptional")} /><input value={requestLeague} onChange={e=>setRequestLeague(e.target.value)} placeholder={t("leagueOptional")} /></div><button className="btn" style={{marginTop:12}} disabled={requestSubmitting} onClick={async()=>{setRequestMessage("");if(!requestName.trim()||!requestCountry.trim()){setRequestMessage(t("teamNameCountryRequired"));return;}const {data:{user}}=await supabase.auth.getUser();if(!user){window.location.href="/login";return;}setRequestSubmitting(true);const {error}=await supabase.from("directory_team_requests").insert({requester_id:user.id,team_name:requestName.trim().slice(0,160),country:requestCountry.trim().slice(0,80),city:requestCity.trim().slice(0,100)||null,league_name:requestLeague.trim().slice(0,160)||null});if(error)setRequestMessage(error.message);else{setRequestMessage(t("requestSubmitted"));setRequestName("");setRequestCity("");setRequestLeague("");}setRequestSubmitting(false);}}>{requestSubmitting?t("submitting"):t("requestTeamAddition")}</button>{requestMessage&&<p className="muted" role="status">{requestMessage}</p>}</Surface></section>

      <div className="hc-directory-summary" aria-live="polite">
        <span>{loading ? t("searchingTeams") : `${totalCount.toLocaleString()} ${totalCount === 1 ? t("teamCountSingular") : t("teamCountPlural")}`}</span>
        {(query.trim() || country || continent || league || division) && (
          <button type="button" className="hc-directory-reset" onClick={() => { setQuery(""); setCountry(""); setContinent(""); setLeague(""); setDivision(""); setPage(0); }}>
            {t("clearFilters")}
          </button>
        )}
      </div>

      <div className="hc-directory-view-toggle" role="group" aria-label={t("teamDirectoryView")}>
        <span>{t("directoryView")}</span>
        <button type="button" className={viewMode === "list" ? "is-active" : ""} onClick={() => setViewMode("list")}>{`☷ ${t("list")}`}</button>
        <button type="button" className={viewMode === "map" ? "is-active" : ""} onClick={() => setViewMode("map")}>{`◎ ${t("map")}`}</button>
      </div>

      {viewMode === "map" && (
        <TeamMap teams={mapTeams.map(team => ({
          ...team,
          latitude: mapCoordinates[team.id]?.latitude ?? null,
          longitude: mapCoordinates[team.id]?.longitude ?? null,
          trustScore: mapTrustScores[team.id]?.score ?? null,
          averageRating: mapTrustScores[team.id]?.averageRating ?? null,
        }))} />
      )}
      {viewMode === "list" && (
      <section className="grid hc-team-directory-list">
        {loading ? (<div className="card"><HoopLoading label="Scanning professional teams..." /></div>) : teams.length === 0 ? (
          <div className="card hc-team-empty">
            <CourtLines variant="arc" className="hc-court-empty-art" />
            <div className="eyebrow hc-court-section-kicker">
              {query.trim() || country || continent || league || division ? t("noMatchingResults") : t("comingSoon")}
            </div>

            <h2>
              {query.trim() || country || continent || league || division ? t("tryAdjustingFilters") : t("noTeamsYet")}
            </h2>

            <p>
              {query.trim() || country || continent || league || division
                ? t("noTeamsMatch")
                : t("teamsWillAppear")}
            </p>
            {(query.trim() || country || continent || league || division) && (
              <button type="button" className="btn dark" onClick={() => { setQuery(""); setCountry(""); setContinent(""); setLeague(""); setDivision(""); setPage(0); }}>
                {t("clearFilters")}
              </button>
            )}
          </div>
        ) : (
          teams.map((team) => (
            <TeamDirectoryRow key={team.id} id={team.id} name={team.name} city={team.city} country={team.country} leagueName={team.league_name} href={`/teams/${team.id}`} kind="mens" trustScore={trustScores[team.id]?.score} trustReviewCount={trustScores[team.id]?.reviewCount ?? undefined} trustVerifiedReviewCount={trustScores[team.id]?.verifiedReviewCount ?? undefined} trustExplanation={trustScores[team.id]?.explanation || undefined} averageRating={trustScores[team.id]?.averageRating} trustTier={trustScores[team.id]?.tier} logoUrl={team.logo_url} />
          ))
        )}
      </section>
      )}
      {viewMode === "list" && !loading && teams.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 12, padding: "0 24px 40px" }}>
          <button
            className="btn dark"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← Previous
          </button>
          <span style={{ display: "inline-flex", alignItems: "center", color: "#888", padding: "0 8px" }}>
            Page {page + 1}
          </span>
          <button
            className="btn dark"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      <CourtLines variant="circle" className="hc-court-divider-art" />

      <section className="hero">
        <div className="eyebrow">
          Player Intelligence
        </div>

        <h2>
          The contract
          <br />
          is only part
          <br />
          of the decision.
        </h2>

        <p>
          Research the organization, understand
          player experiences, and make your next
          move with more information.
        </p>

        <div className="actions">
          <Link
            href="/signup"
            className="btn"
          >
            Create Free Account
          </Link>

          <Link
            href="/membership"
            className="btn dark"
          >
            Unlock Full Access
          </Link>
        </div>
      </section>
</main>
  );
}
