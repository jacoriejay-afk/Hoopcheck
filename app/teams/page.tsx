"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import GeoBadge from "../../components/GeoBadge";

type Team = {
  id: string;
  name: string;
  country: string | null;
  league_name: string | null;
  league_id: string | null;
  division?: string | null;
  city: string | null;
};

export default function TeamsPage() {
  const [teams, setTeams] =
    useState<Team[]>([]);

  const [loading, setLoading] = useState(true);
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
    Promise.all([
      supabase.from("leagues").select("id,name,country,level").eq("active", true).order("name"),
      supabase.from("teams").select("country").eq("active", true).not("country", "is", null),
    ]), 8000, [{data:[],error:new Error("timeout")},{data:[],error:new Error("timeout")}]).then(([leagueResult, countryResult]) => {
      setLeagueOptions(leagueResult.data || []);
      setDirectoryCountries(Array.from(new Set((countryResult.data || []).map((row) => row.country).filter(Boolean) as string[])).sort());
    });
  }, []);

  const countries = directoryCountries;
  const divisions = Array.from(new Set(leagueOptions.map((item) => item.level).filter(Boolean) as string[])).sort();

  useEffect(() => {
    async function loadTeams() {
      setLoading(true);
      let request = supabase
        .from("teams")
        .select("id, name, country, league_name, league_id, city, leagues:league_id(level)")
        .eq("active", true)
        .order("name");

      const term = query.trim();
      if (term) {
        const escaped = term.replace(/[%_]/g, "\\$&");
        request = request.or(
          `name.ilike.%${escaped}%,country.ilike.%${escaped}%,city.ilike.%${escaped}%,league_name.ilike.%${escaped}%`
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

      const { data, error } = await request.range(
        page * pageSize,
        page * pageSize + pageSize - 1
      );

      if (error) {
        console.error("Error loading teams:", error);
        setTeams([]);
        setHasMore(false);
        setTotalCount(0);
      } else {
        setTeams(data || []);
        setTotalCount((page * pageSize) + (data?.length ?? 0));
        setHasMore((data?.length ?? 0) === pageSize);
      }

      setLoading(false);
    }

    loadTeams();
  }, [query, country, continent, league, division, leagueOptions, page]);

  return (
    <main>
      <nav className="nav">
        <Link
          href="/"
          className="logo"
        >
          Hoop<span>Check</span>
        </Link>

        <div className="links">
          <button type="button" onClick={() => window.history.back()} style={{ background: "transparent", border: "1px solid #333", color: "#fff", borderRadius: 7, padding: "7px 10px", cursor: "pointer" }}>← Back</button>
          <Link
            href="/search"
            className="search-nav"
          >
            Search
          </Link>

          <Link href="/dashboard">
            Dashboard
          </Link>

          <Link
            href="/membership"
            className="btn"
          >
            Membership
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          HoopCheck Teams
        </div>

        <h1>
          Know the organization
          <br />
          before you sign.
        </h1>

        <p>
          Explore professional basketball
          organizations and learn from players
          who have already experienced them.
        </p>

        <div className="research-search">
          <div className="search-label">
            GLOBAL RESEARCH
          </div>

          <Link
            href="/search"
            className="search-button"
          >
            <span>
              Search coaches, teams, or leagues...
            </span>

            <strong>
              Search →
            </strong>
          </Link>
        </div>

   </section>

      <section className="hero">
        <div className="research-search">
          <div className="search-label">TEAM DIRECTORY</div>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder="Search teams, leagues, countries, or cities..."
            aria-label="Search teams"
            style={{ width: "100%", padding: "14px 16px", borderRadius: 10, border: "1px solid #333", background: "#0d0d0d", color: "#fff", fontSize: 15 }}
          />
          <div className="team-filter-row">
            <select value={continent} onChange={(e) => { setContinent(e.target.value); setCountry(""); setPage(0); }} aria-label="Filter teams by continent">
              <option value="">All continents</option>
              {Object.keys(CONTINENT_COUNTRIES).map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}
            </select>
            <select value={country} onChange={(e) => { setCountry(e.target.value); setPage(0); }} aria-label="Filter teams by country">
              <option value="">All countries</option>
              {countries.filter((item) => countryInContinent(item, continent)).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={league} onChange={(e) => { setLeague(e.target.value); setPage(0); }} aria-label="Filter teams by league">
              <option value="">All leagues</option>
              {leagueOptions.filter(item => !country || item.country === country).map(item => <option key={item.id} value={item.id}>{item.name}{item.level ? ` — ${item.level}` : ""}</option>)}
            </select>
            <select value={division} onChange={(e) => { setDivision(e.target.value); setPage(0); }} aria-label="Filter teams by division">
              <option value="">All divisions</option>
              {divisions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="hero" style={{paddingTop:0}}><div className="dashboard-card" style={{border:"1px solid var(--orange)"}}><div className="eyebrow">DIRECTORY REQUEST</div><h2>Don’t see your team?</h2><p className="muted">Request a professional team to be added to HoopCheck. Our admin team will review the submission.</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}><input value={requestName} onChange={e=>setRequestName(e.target.value)} placeholder="Team name" /><input value={requestCountry} onChange={e=>setRequestCountry(e.target.value)} placeholder="Country" /><input value={requestCity} onChange={e=>setRequestCity(e.target.value)} placeholder="City (optional)" /><input value={requestLeague} onChange={e=>setRequestLeague(e.target.value)} placeholder="League (optional)" /></div><button className="btn" style={{marginTop:12}} disabled={requestSubmitting} onClick={async()=>{setRequestMessage("");if(!requestName.trim()||!requestCountry.trim()){setRequestMessage("Team name and country are required.");return;}const {data:{user}}=await supabase.auth.getUser();if(!user){window.location.href="/login";return;}setRequestSubmitting(true);const {error}=await supabase.from("directory_team_requests").insert({requester_id:user.id,team_name:requestName.trim().slice(0,160),country:requestCountry.trim().slice(0,80),city:requestCity.trim().slice(0,100)||null,league_name:requestLeague.trim().slice(0,160)||null});if(error)setRequestMessage(error.message);else{setRequestMessage("Request submitted for admin review.");setRequestName("");setRequestCity("");setRequestLeague("");}setRequestSubmitting(false);}}>{requestSubmitting?"Submitting...":"Request Team Addition"}</button>{requestMessage&&<p className="muted" role="status">{requestMessage}</p>}</div></section>

      <section className="grid">
        {loading ? (<div className="card"><HoopLoading label="Scanning professional teams..." /></div>) : teams.length === 0 ? (
          <div className="card">
            <div className="eyebrow">
              Coming Soon
            </div>

            <h2>
              No teams yet
            </h2>

            <p>
              Teams will appear here as
              HoopCheck&apos;s global basketball
              database grows.
            </p>
          </div>
        ) : (
          teams.map((team) => (
            <div
              className="card"
              key={team.id}
            >
              <div className="eyebrow">
                Professional Team
              </div>

              <GeoBadge country={team.country} />

              <h2>
                {team.name}
              </h2>

              <p>
                {team.city &&
                team.country
                  ? `${team.city}, ${team.country}`
                  : team.country ||
                    team.city ||
                    "Location not listed"}
              </p>

              {team.league_name && (
                <p>
                  League:{" "}
                  <strong>
                    {team.league_name}
                  </strong>
                </p>
              )}

              <Link
                href={`/teams/${team.id}`}
                className="btn"
              >
                View Team
              </Link>
            </div>
          ))
        )}
      </section>

      {!loading && teams.length > 0 && (
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
