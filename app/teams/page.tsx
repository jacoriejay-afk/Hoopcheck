"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { supabase } from "../../lib/supabase";

type Team = {
  id: string;
  name: string;
  country: string | null;
  league_name: string | null;
  city: string | null;
};

export default function TeamsPage() {
  const [teams, setTeams] =
    useState<Team[]>([]);

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 24;

  useEffect(() => {
    async function loadTeams() {
      setLoading(true);
      let request = supabase
        .from("teams")
        .select("id, name, country, league_name, city")
        .eq("active", true)
        .order("name");

      const term = query.trim();
      if (term) {
        const escaped = term.replace(/[%_]/g, "\\  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadTeams() {
      const {
        data,
        error,
      } = await supabase
        .from("teams")
        .select(
          "id, name, country, league_name, city"
        )
        .order("name");");
        request = request.or(
          `name.ilike.%${escaped}%,country.ilike.%${escaped}%,city.ilike.%${escaped}%,league_name.ilike.%${escaped}%`
        );
      }
      if (country) request = request.eq("country", country);

      const { data, error, count } = await request
        .range(page * pageSize, page * pageSize + pageSize);

      if (error) {

      if (error) {
        console.error("Error loading teams:", error);
        setTeams([]);
        setHasMore(false);
      } else {
        setTeams(data || []);
        setHasMore((count ?? 0) > (page + 1) * pageSize);
      }

      setLoading(false);
    }

    loadTeams();
  }, [query, country, page]);

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
        </div>
      </section>

      <section className="grid">
        {loading ? (
          <div className="card">
            <div className="eyebrow">
              HoopCheck
            </div>

            <h2>
              Loading teams...
            </h2>

            <p>
              Finding professional teams
              in the HoopCheck database.
            </p>
          </div>
        ) : teams.length === 0 ? (
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
