"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Coach = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
};

type Team = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  league_name: string | null;
};

type League = {
  id: string;
  name: string;
  country: string | null;
  level: string | null;
};

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function search() {
      if (!query) {
        setCoaches([]);
        setTeams([]);
        setLeagues([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const searchTerm = `%${query}%`;

        const [coachResult, teamResult, leagueResult] =
          await Promise.all([
            supabase
              .from("coaches")
              .select("id, name, country, city")
              .or(
                `name.ilike.${searchTerm},country.ilike.${searchTerm},city.ilike.${searchTerm}`
              )
              .order("name")
              .limit(20),

            supabase
              .from("teams")
              .select("id, name, country, city, league_name")
              .or(
                `name.ilike.${searchTerm},country.ilike.${searchTerm},city.ilike.${searchTerm},league_name.ilike.${searchTerm}`
              )
              .order("name")
              .limit(20),

            supabase
              .from("leagues")
              .select("id, name, country, level")
              .or(
                `name.ilike.${searchTerm},country.ilike.${searchTerm},level.ilike.${searchTerm}`
              )
              .order("name")
              .limit(20),
          ]);

        if (coachResult.error) {
          throw coachResult.error;
        }

        if (teamResult.error) {
          throw teamResult.error;
        }

        if (leagueResult.error) {
          throw leagueResult.error;
        }

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
  }, [query]);

  const totalResults =
    coaches.length + teams.length + leagues.length;

  return (
    <main className="search-page">
      <nav className="nav">
        <Link href="/" className="logo">
          Hoop<span>Check</span>
        </Link>

        <div className="links">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/login">Log in</Link>
          <Link href="/signup" className="btn">
            Sign Up
          </Link>
        </div>
      </nav>

      <section className="search-hero">
        <div className="eyebrow">Global Research</div>

        <h1>
          Search the
          <br />
          basketball world.
        </h1>

        <p>
          Find coaches, professional teams, and leagues from around
          the world.
        </p>

        <form action="/search" method="get" className="search-form">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search coaches, teams, or leagues..."
            aria-label="Search coaches, teams, or leagues"
          />

          <button type="submit" className="btn">
            Search
          </button>
        </form>
      </section>

      {query && (
        <section className="results-section">
          <div className="results-header">
            <div>
              <div className="eyebrow">Search Results</div>
              <h2>
                Results for &quot;{query}&quot;
              </h2>
            </div>

            {!loading && (
              <div className="result-count">
                {totalResults} result
                {totalResults === 1 ? "" : "s"}
              </div>
            )}
          </div>

          {loading && (
            <div className="state-card">
              <p>Searching HoopCheck...</p>
            </div>
          )}

          {error && (
            <div className="state-card error">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && totalResults === 0 && (
            <div className="state-card">
              <div className="eyebrow">No Matches</div>
              <h3>Nothing found.</h3>
              <p>
                Try searching for a different coach, team, league,
                country, or city.
              </p>
            </div>
          )}

          {!loading && !error && coaches.length > 0 && (
            <section className="result-group">
              <div className="group-heading">
                <span>01</span>
                <h3>Coaches</h3>
              </div>

              <div className="result-grid">
                {coaches.map((coach) => (
                  <Link
                    href={`/coaches/${coach.id}`}
                    key={coach.id}
                    className="result-card"
                  >
                    <div className="result-type">COACH</div>

                    <h4>{coach.name}</h4>

                    <p>
                      {coach.city && coach.country
                        ? `${coach.city}, ${coach.country}`
                        : coach.country || coach.city || "Location unavailable"}
                    </p>

                    <span className="result-link">
                      Research Coach →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!loading && !error && teams.length > 0 && (
            <section className="result-group">
              <div className="group-heading">
                <span>02</span>
                <h3>Teams</h3>
              </div>

              <div className="result-grid">
                {teams.map((team) => (
                  <Link
                    href={`/teams/${team.id}`}
                    key={team.id}
                    className="result-card"
                  >
                    <div className="result-type">TEAM</div>

                    <h4>{team.name}</h4>

                    <p>
                      {team.city && team.country
                        ? `${team.city}, ${team.country}`
                        : team.country || team.city || "Location unavailable"}
                    </p>

                    {team.league_name && (
                      <div className="result-meta">
                        {team.league_name}
                      </div>
                    )}

                    <span className="result-link">
                      Research Team →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!loading && !error && leagues.length > 0 && (
            <section className="result-group">
              <div className="group-heading">
                <span>03</span>
                <h3>Leagues</h3>
              </div>

              <div className="result-grid">
                {leagues.map((league) => (
                  <Link
                    href={`/leagues/${league.id}`}
                    key={league.id}
                    className="result-card"
                  >
                    <div className="result-type">LEAGUE</div>

                    <h4>{league.name}</h4>

                    <p>
                      {league.country || "Country unavailable"}
                    </p>

                    {league.level && (
                      <div className="result-meta">
                        Level: {league.level}
                      </div>
                    )}

                    <span className="result-link">
                      Research League →
                    </span>
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

          <h2>
            Search before
            <br />
            you sign.
          </h2>

          <div className="quick-links">
            <Link href="/coaches" className="quick-card">
              <span>01</span>
              <strong>Browse Coaches</strong>
              <small>Research player experiences.</small>
            </Link>

            <Link href="/teams" className="quick-card">
              <span>02</span>
              <strong>Browse Teams</strong>
              <small>Explore professional organizations.</small>
            </Link>

            <Link href="/leagues" className="quick-card">
              <span>03</span>
              <strong>Browse Leagues</strong>
              <small>Explore leagues worldwide.</small>
            </Link>
          </div>
        </section>
      )}
</main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="search-page">
          <p>Loading search...</p>
        </main>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
