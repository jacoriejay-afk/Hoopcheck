"use client";

import { supabase } from "../../lib/supabase";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TeamDirectoryRow from "../../components/TeamDirectoryRow";
import HoopLoading from "../../components/HoopLoading";
import SearchBar from "../../components/SearchBar";


type WomensTeam = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  league_id: string | null;
  league_name: string | null;
};

export default function Womens() {
  const [teams, setTeams] = useState<WomensTeam[]>([]);
  const [leagues, setLeagues] = useState<{id:string;name:string;country:string|null;level:string|null}[]>([]);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [league, setLeague] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [teamResult, leagueResult] = await Promise.all([
        supabase.from("womens_teams")
          .select("id,name,country,city,league_id,league_name")
          .eq("active", true).order("name"),
        supabase.from("womens_leagues")
          .select("id,name,country,level")
          .eq("active", true).order("name"),
      ]);
      if (!mounted) return;
      if (teamResult.error) console.error("Unable to load women's teams:", teamResult.error);
      if (leagueResult.error) console.error("Unable to load women's leagues:", leagueResult.error);
      setTeams(teamResult.data || []);
      setLeagues(leagueResult.data || []);
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const countries = useMemo(
    () => Array.from(new Set(teams.map(team => team.country).filter(Boolean) as string[])).sort(),
    [teams]
  );
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return teams.filter(team =>
      (!term || [team.name, team.city, team.country, team.league_name].join(" ").toLowerCase().includes(term)) &&
      (!country || team.country === country) &&
      (!league || team.league_id === league)
    );
  }, [teams, query, country, league]);

  return (
    <main className="page-shell hc-womens-directory-page">
      <div className="page-container">
        <header className="hc-womens-directory-header">
          <div>
            <p className="eyebrow">WOMEN’S BASKETBALL</p>
            <h1>Find a team</h1>
            <p className="muted">Search professional women’s teams by club, league, city, or country.</p>
          </div>
          <Link href="/teams" className="hc-womens-switch-link">Men’s teams <span aria-hidden="true">→</span></Link>
        </header>

        <nav className="hc-directory-switcher hc-womens-compact-switcher" aria-label="Browse HoopCheck directories">
          <Link href="/teams">Men’s Teams</Link>
          <Link href="/womens" aria-current="page" className="is-active">Women’s Teams</Link>
          <Link href="/coaches">Coaches</Link>
          <Link href="/leagues">Leagues</Link>
          <Link href="/players">Find Players</Link>
        </nav>

        <section className="hc-womens-search-panel" aria-label="Search women’s teams">
          <SearchBar inputId="womens-team-search" value={query} onChange={setQuery} placeholder="Search players, coaches, teams, or leagues" ariaLabel="Search women’s teams" onSubmit={(value) => setQuery(value)} />
          <div className="hc-womens-filters">
            <label>
              <span>COUNTRY</span>
              <select value={country} onChange={event => setCountry(event.target.value)}>
                <option value="">All countries</option>
                {countries.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>LEAGUE</span>
              <select value={league} onChange={event => setLeague(event.target.value)}>
                <option value="">All leagues</option>
                {leagues.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            {(country || league) && <button type="button" className="hc-womens-reset" onClick={() => { setCountry(""); setLeague(""); }}>Clear filters</button>}
          </div>
        </section>

        <div className="hc-womens-results-heading">
          <h2>Teams</h2>
          <span>{loading ? "Loading…" : `${filtered.length} ${filtered.length === 1 ? "team" : "teams"}`}</span>
        </div>

        {loading ? <div className="hc-womens-loading"><HoopLoading label="Loading women’s teams…" /></div> : filtered.length ? (
          <section className="hc-womens-team-list" aria-label="Women’s team results">
            {filtered.map(team => (
              <TeamDirectoryRow key={team.id} id={team.id} name={team.name} city={team.city} country={team.country} leagueName={team.league_name} href={`/womens/${team.id}`} kind="womens" />           ))}
          </section>
        ) : (
          <section className="hc-womens-empty-state">
            <h2>No teams match that search</h2>
            <p>Try another team name or clear your filters.</p>
            <button type="button" onClick={() => { setQuery(""); setCountry(""); setLeague(""); }}>Reset search</button>
          </section>
        )}
      </div>
    </main>
  );
}
