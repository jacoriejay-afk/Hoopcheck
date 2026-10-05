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
  division: string | null;
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
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 24;

  const CONTINENT_COUNTRIES: Record<string, string[]> = {
    Europe: ["Albania","Andorra","Armenia","Austria","Azerbaijan","Belarus","Belgium","Bosnia and Herzegovina","Bulgaria","Croatia","Cyprus","Czechia","Denmark","Estonia","Finland","France","Georgia","Germany","Greece","Hungary","Iceland","Ireland","Israel","Italy","Kosovo","Latvia","Lithuania","Luxembourg","Malta","Moldova","Montenegro","Netherlands","North Macedonia","Norway","Poland","Portugal","Romania","Russia","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Türkiye","Ukraine","United Kingdom"],
    Asia: ["China","Japan","South Korea","Philippines","India","Indonesia","Lebanon","Jordan","Saudi Arabia","United Arab Emirates","Qatar","Bahrain","Iran","Iraq","Kazakhstan","Uzbekistan"],
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
    supabase.from("leagues").select("id,name,country,level").eq("active", true).order("name").then(({data}) => setLeagueOptions(data || []));
  }, []);

  const countries = Array.from(new Set(teams.map((team) => team.country).filter(Boolean) as string[])).sort();
  const divisions = Array.from(new Set(leagueOptions.map((item) => item.level).filter(Boolean) as string[])).sort();

  useEffect(() => {
    async function loadTeams() {
      setLoading(true);
      let request = supabase
        .from("teams")
        .select("id, name, country, league_name, league_id, city, leagues:league_id(level)", { count: "exact" })
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

      const { data, error, count } = await request.range(
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
        const total = count ?? 0;
        setTotalCount(total);
        setHasMore((page + 1) * pageSize < total);
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

        <div className="actions">
          <Link
            href="/coaches"
            className="btn dark"
          >
            Research Coaches
          </Link>

          <Link
            href="/leagues"
            className="btn dark"
          >
            Research Leagues
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
