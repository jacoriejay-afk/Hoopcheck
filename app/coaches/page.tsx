"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";

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
  const [query, setQuery] = useState("");
  const filteredCoaches = coaches.filter((coach) => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return true;
    return [coach.name, coach.country, coach.city].some((value) => value?.toLocaleLowerCase().includes(term));
  });

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
    <main className="hc-coaches-directory-page">
<section className="hero hc-directory-hero">
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

      <nav className="hc-directory-switcher" aria-label="Browse HoopCheck directories">
        <span className="hc-directory-switcher-label">BROWSE DIRECTORIES</span>
        <Link href="/teams" aria-current={undefined}>Men&apos;s Teams</Link>
        <Link href="/womens">Women&apos;s Teams</Link>
        <Link href="/coaches">Coaches</Link>
        <Link href="/leagues">Leagues</Link>
        <Link href="/players">Find Players</Link>
        <Link href="/search">Reviews</Link>
      </nav>

      <section className="hc-coach-directory-tools" aria-label="Search coaches">
        <label htmlFor="coach-directory-search">Find a coach</label>
        <input id="coach-directory-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by coach name, country, or city…" autoComplete="off" />
        <div className="hc-coach-directory-summary" aria-live="polite">
          {loading ? "Searching coaching profiles…" : `${filteredCoaches.length} of ${coaches.length} coach${coaches.length === 1 ? "" : "es"} shown`}
        </div>
      </section>

      <section className="grid hc-team-directory-list">
        {loading ? (<div className="card"><HoopLoading label="Scanning coaching profiles..." /></div>) : coaches.length === 0 ? (
          <div className="card hc-coach-empty">
            <div className="eyebrow">Coming Soon</div>
            <h2>No coaches yet</h2>
            <p>Coach profiles will appear here as HoopCheck’s global basketball database grows.</p>
            <Link href="/search" className="btn dark">Search all directories</Link>
          </div>
        ) : filteredCoaches.length === 0 ? (
          <div className="card hc-coach-empty">
            <div className="eyebrow">No matching coaches</div>
            <h2>Try another search</h2>
            <p>No coach profile matches “{query}”. Try a different name, country, or city.</p>
            <button type="button" className="btn dark" onClick={() => setQuery("")}>Clear search</button>
          </div>
        ) : (
          filteredCoaches.map((coach) => (
            <div
              className="card hc-team-row"
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
