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

  const [loading, setLoading] =
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
        .order("name");

      if (error) {
        console.error(
          "Error loading teams:",
          error
        );

        setTeams([]);
      } else {
        setTeams(data || []);
      }

      setLoading(false);
    }

    loadTeams();
  }, []);

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

      <style jsx>{`
        .search-nav {
          color: #ff6a00;
          font-weight: 800;
        }

        .research-search {
          width: 100%;
          max-width: 760px;
          margin: 35px 0 10px;
        }

        .search-label {
          margin-bottom: 9px;
          color: #ff6a00;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .search-button {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          width: 100%;
          min-height: 62px;
          padding: 0 20px;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          background: #111;
          color: #fff;
          text-decoration: none;
          transition:
            border-color 0.2s ease,
            background 0.2s ease;
        }

        .search-button:hover {
          border-color: #ff6a00;
          background: #161616;
        }

        .search-button span {
          color: #888;
          font-size: 15px;
          text-align: left;
        }

        .search-button strong {
          color: #ff6a00;
          font-size: 13px;
          white-space: nowrap;
        }

        @media (max-width: 800px) {
          .search-button {
            align-items: flex-start;
            flex-direction: column;
            justify-content: center;
            gap: 8px;
            padding: 15px 18px;
          }
        }
      `}</style>
    </main>
  );
}
