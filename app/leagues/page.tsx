"use client";

import {
useEffect,
useState,
Fragment,
} from "react";
import Link from "next/link";
import DirectoryLayout from "../../components/DirectoryLayout";
import "./league-directory-compact.css";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import SearchBar from "../../components/SearchBar";
import GeoBadge from "../../components/GeoBadge";
import TeamLogo from "../../components/TeamLogo";
import { countryFlag } from "../../lib/countryFlag";

type League = {
id: string;
name: string;
country: string | null;
level: string | null;
season: string | null;
active: boolean;
logo_url: string | null;
};

export default function LeaguesPage() {
const [leagues, setLeagues] = useState<League[]>([]);
const [loading, setLoading] = useState(true);
const [country, setCountry] = useState("");
const [query, setQuery] = useState("");
const [sortMode, setSortMode] = useState<"country" | "name" | "logo">("country");
const [showAll, setShowAll] = useState(false);
const countrySummary = [...new Set(leagues.map(league => league.country || "Other"))].map(name => ({
  name, count: leagues.filter(league => (league.country || "Other") === name).length,
})).sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
const filteredLeagues = leagues.filter((league) => {
  if (country && league.country !== country) return false;
  const term = query.trim().toLocaleLowerCase();
  if (!term) return true;
  return [league.name, league.country, league.level, league.season].some((value) => value?.toLocaleLowerCase().includes(term));
}).sort((a,b) => sortMode === "name" ? a.name.localeCompare(b.name) :
  sortMode === "logo" ? Number(Boolean(b.logo_url)) - Number(Boolean(a.logo_url)) || a.name.localeCompare(b.name) :
  (a.country || "Other").localeCompare(b.country || "Other") || a.name.localeCompare(b.name));
const visibleLeagues = showAll ? filteredLeagues : filteredLeagues.slice(0, 36);
const logoCount = leagues.filter(league => Boolean(league.logo_url)).length;

useEffect(() => {
let active = true;

async function loadLeagues() {
  try {
    const { data, error } = await supabase
      .from("leagues")
      .select("id, name, country, level, season, active, logo_url")
      .eq("active", true)
      .order("name");

    if (error) throw error;
    if (active) setLeagues(data || []);
  } catch (error) {
    console.error("Error loading leagues:", error);
    if (active) setLeagues([]);
  } finally {
    if (active) setLoading(false);
  }
}

void loadLeagues();
return () => { active = false; };
}, []);

return (
<main className="hc-leagues-directory-page">
<DirectoryLayout current="leagues" />

  <section className="hc-league-filter" aria-label="Filter leagues">
    <label htmlFor="league-search">Find a league</label>
    <SearchBar inputId="league-search" value={query} onChange={setQuery} placeholder="Search leagues, teams, or countries" ariaLabel="Search leagues" onSubmit={setQuery} />
    <label htmlFor="league-country">League country</label>
    <select id="league-country" value={country} onChange={(e) => setCountry(e.target.value)}>
      <option value="">All countries</option>
      {Array.from(new Set(leagues.map((league) => league.country).filter(Boolean) as string[])).sort().map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
    <label htmlFor="league-sort">Organize by</label>
    <select id="league-sort" value={sortMode} onChange={event => { setSortMode(event.target.value as typeof sortMode); setShowAll(false); }}>
      <option value="country">Country → league</option><option value="name">League name</option><option value="logo">Logo coverage</option>
    </select>
    <p aria-live="polite">{loading ? "Loading leagues…" : `${filteredLeagues.length.toLocaleString()} leagues · ${logoCount} of ${leagues.length} have logo URLs`}</p>
    {(query || country) && <button type="button" className="hc-directory-reset" onClick={() => { setQuery(""); setCountry(""); }}>Clear filters</button>}
  </section>
  {!loading && leagues.length > 0 && <nav className="hc-league-country-index" aria-label="Browse countries with the most listed leagues">
    <button type="button" aria-pressed={!country} onClick={() => { setCountry(""); setShowAll(false); }}>All countries</button>
    {countrySummary.slice(0, 8).map(item => <button type="button" key={item.name} aria-pressed={country === item.name} onClick={() => { setCountry(current => current === item.name ? "" : item.name); setShowAll(false); }}>{item.name} <small>{item.count}</small></button>)}
  </nav>}
  <section className="hc-league-directory-grid">
    {loading ? (<div className="card"><HoopLoading variant="inline" label="Scanning professional leagues..." /></div>) : leagues.length === 0 ? (
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
      ) : visibleLeagues.map((league, index) => <Fragment key={league.id}>
        {sortMode === "country" && (index === 0 || visibleLeagues[index - 1]?.country !== league.country) &&
          <h2 className="hc-league-country-divider">{countryFlag(league.country || "")} {league.country || "Other countries"}</h2>}
        {(
        <div
          className="card hc-team-row hc-league-compact-card"
        >
          <div className="hc-league-row-head">
            <span className="hc-dir-crest hc-dir-crest--league"><TeamLogo name={league.name} logoUrl={league.logo_url} size={56} /></span>
            <div>
              <div className="eyebrow">
                Professional League
              </div>
              <GeoBadge country={league.country} regional={league.country === "Europe"} />
            </div>
          </div>
          <h2>{league.name}</h2>
          <small className="hc-league-logo-state">{league.logo_url ? "League crest available" : "League badge placeholder · official logo pending"}</small>
          {league.country ? <span className="hc-dir-flagchip">{countryFlag(league.country) ? <span className="hc-dir-flag" aria-hidden="true">{countryFlag(league.country)}</span> : null}<span>{league.country}</span></span> : <p>Country not listed</p>}
          <p style={{ color: "var(--orange)", fontWeight: 900 }}>Season: {league.season || "Not listed"}</p>
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
            className="btn button-primary"
          >
            View League
          </Link>
        </div>
      )}</Fragment>)
    )}
  </section>
  {!loading && filteredLeagues.length > 36 && <div className="hc-league-page-more"><p className="muted" role="status">Showing {visibleLeagues.length} of {filteredLeagues.length} leagues.</p><button type="button" className="btn dark" onClick={() => setShowAll(value => !value)}>{showAll ? "Show compact directory" : "Show all matching leagues"}</button></div>}
  <section className="hero">
    <div className="eyebrow">
      League Insight
    </div>
    <h2>
      Every league
      <br />
      has a story.
    </h2>
    <p>
      Explore first-hand experiences from people who have competed in these leagues before making your next move.
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
