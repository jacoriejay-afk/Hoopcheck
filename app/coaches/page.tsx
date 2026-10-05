"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { supabase } from "../../lib/supabase";

type Coach = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
};

export default function CoachesPage() {
  const [coaches, setCoaches] =
    useState<Coach[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadCoaches() {
      const {
        data,
        error,
      } = await supabase
        .from("coaches")
        .select(
          "id, name, country, city"
        )
        .order("name");

      if (error) {
        console.error(
          "Error loading coaches:",
          error
        );

        setCoaches([]);
      } else {
        setCoaches(data || []);
      }

      setLoading(false);
    }

    loadCoaches();
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
          HoopCheck Coaches
        </div>

        <h1>
          Know the coach
          <br />
          before you sign.
        </h1>

        <p>
          Research coaches through real
          player experiences from professional
          basketball around the world.
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
            href="/teams"
            className="btn dark"
          >
            Research Teams
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
              Loading coaches...
            </h2>

            <p>
              Finding coaches in the
              HoopCheck database.
            </p>
          </div>
        ) : coaches.length === 0 ? (
          <div className="card">
            <div className="eyebrow">
              Coming Soon
            </div>

            <h2>
              No coaches yet
            </h2>

            <p>
              Coaches will appear here as
              HoopCheck&apos;s global basketball
              database grows.
            </p>
          </div>
        ) : (
          coaches.map((coach) => (
            <div
              className="card"
              key={coach.id}
            >
              <div className="eyebrow">
                Coach
              </div>

              <h2>
                {coach.name}
              </h2>

              <p>
                {coach.city &&
                coach.country
                  ? `${coach.city}, ${coach.country}`
                  : coach.country ||
                    coach.city ||
                    "Location not listed"}
              </p>

              <Link
                href={`/coaches/${coach.id}`}
                className="btn"
              >
                View Coach
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
          Your next coach
          <br />
          matters.
        </h2>

        <p>
          See what professional players have
          experienced before you make your
          next move.
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
