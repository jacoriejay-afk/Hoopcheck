"use client";

import {
useEffect,
useState,
} from "react";
import Link from "next/link";
import DirectoryLayout from "../../components/DirectoryLayout";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import SearchBar from "../../components/SearchBar";
import GeoBadge from "../../components/GeoBadge";

type League = {
id: string;
name: string;
country: string | null;
level: string | null;
season: string | null;
active: boolean;
};

export default function LeaguesPage() {
const [leagues, setLeagues] = useState<League[]>([]);
const [loading, setLoading] = useState(true);
const [country, setCountry] = useState("");
const [query, setQuery] = useState("");
const filteredLeagues = leagues.filter((league) => {
  if (country && league.country !== country) return false;
  const term = query.trim().toLocaleLowerCase();
  if (!term) return true;
  return [league.name, league.country, league.level, league.season].some((value) => value?.toLocaleLowerCase().includes(term));
});

useEffect(() => {
async function loadLeagues() {
const { data, error } = await supabase
.from("leagues")
.select("id, name, country, level, season, active")
.eq("active", true)
.order("name");

  if (error) {
    console.error("Error loading leagues:", error);
    setLeagues([]);
  } else {
    setLeagues(data || []);
  }
  setLoading(false);
}
loadLeagues();

}, []);

return (
<main className="hc-leagues-directory-page">
<DirectoryLayout current="leagues" />

  <section className="hc-league-filter" aria-label="Filter leagues">
    <label htmlFor="league-search">Find a league</label>
    <SearchBar inputId="league-search" value={query} onChange={setQuery} placeholder="Search players, coaches, teams, or leagues" ariaLabel="Search leagues" onSubmit={setQuery} />
    <label htmlFor="league-country">League country</label>
    <select id="league-country" value={country} onChange={(e) => setCountry(e.target.value)}>
      <option value="">All countries</option>
      {Array.from(new Set(leagues.map((league) => league.country).filter(Boolean) as string[])).sort().map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
    <p aria-live="polite">{loading ? "Loading leagues…" : `${filteredLeagues.length.toLocaleString()} ${filteredLeagues.length === 1 ? "league" : "leagues"}`}</p>
    {(query || country) && <button type="button" className="hc-directory-reset" onClick={() => { setQuery(""); setCountry(""); }}>Clear filters</button>}
  </section>
  <section className="grid hc-team-directory-list">
    {loading ? (<div className="card"><HoopLoading label="Scanning professional leagues..." /></div>) : leagues.length === 0 ? (
      <div className="card">
        <div className="eyebrow">
          Coming Soon
        </div>
        <h2>
          No leagues yet
        </h2>
        <p>
          Leagues will appear here as HoopCheck&apos;s
          global basketball database grows.
        </p>
      </div>
    ) : (
      filteredLeagues.length === 0 ? (
        <div className="card hc-directory-empty">
          <div className="eyebrow">No matching leagues</div>
          <h2>Adjust your filters</h2>
          <p>No league matches the current search and country filter. Try another search or reset the filters.</p>
          <button type="button" className="btn dark" onClick={() => { setCountry(""); setQuery(""); }}>Clear filters</button>
        </div>
      ) : filteredLeagues.map((league) => (
        <div
          className="card hc-team-row"
          key={league.id}
        >
          <div className="eyebrow">
            Professional League
          </div>
          <GeoBadge country={league.country} regional={league.country === "Europe"} />
          <h2>
            {league.name}
          </h2>
          <p>
            {league.country || "Country not listed"}
          </p>
          <p style={{ color: "var(--orange)", fontWeight: 900 }}>Season: {league.season || "2026-27"}</p>
          {league.level && (
            <p>
              Level:{" "}
              <strong>
                {league.level}
              </strong>
            </p>
          )}
          <Link
            href={`/leagues/${league.id}`}
            className="btn"
          >
            View League
          </Link>
        </div>
      ))
    )}
  </section>
  <section className="hero">
    <div className="eyebrow">
      Player Intelligence
    </div>
    <h2>
      Every league
      <br />
      has a story.
    </h2>
    <p>
      Learn from the players who have already played
      there before deciding where your career goes next.
    </p>
    <div className="actions">
      <Link href="/signup" className="btn">
        Create Free Account
      </Link>
      <Link href="/membership" className="btn dark">
        Unlock Full Access
      </Link>
    </div>
  </section>
</main>

);
}
