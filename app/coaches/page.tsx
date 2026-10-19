"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import SearchBar from "../../components/SearchBar";
import CourtLines from "../../components/CourtLines";

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
    let active = true;

    async function loadCoaches() {
      try {
        const { data, error } = await supabase
          .from("coaches")
          .select("id, name, country, city")
          .order("name");

        if (error) throw error;
        if (active) setCoaches(data || []);
      } catch (error) {
        console.error("Error loading coaches:", error);
        if (active) setCoaches([]);
      } finally {
        // Never leave the directory stuck on its loading screen after a
        // network, Supabase, or unexpected runtime error.
        if (active) setLoading(false);
      }
    }

    void loadCoaches();
    return () => {
      active = false;
    };
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
        <SearchBar inputId="coach-directory-search" value={query} onChange={setQuery} placeholder="Search players, coaches, teams, or leagues" ariaLabel="Search coaches" onSubmit={setQuery} />
        <div className="hc-coach-directory-summary" aria-live="polite">
          {loading ? "Searching coaching profiles…" : `${filteredCoaches.length} of ${coaches.length} coach${coaches.length === 1 ? "" : "es"} shown`}
        </div>
      </section>

      <section className="grid hc-team-directory-list">
        {loading ? (<div className="card"><HoopLoading label="Scanning coaching profiles..." /></div>) : coaches.length === 0 ? (
          <div className="card hc-coach-empty">
            <CourtLines variant="circle" className="hc-court-empty-art" />
            <div className="eyebrow hc-court-section-kicker">Coming Soon</div>
            <h2>No coaches yet</h2>
            <p>Coach profiles will appear here as HoopCheck’s global basketball database grows.</p>
            <Link href="/search" className="btn dark">Search all directories</Link>
          </div>
        ) : filteredCoaches.length === 0 ? (
          <div className="card hc-coach-empty">
            <CourtLines variant="arc" className="hc-court-empty-art" />
            <div className="eyebrow hc-court-section-kicker">No matching coaches</div>
            <h2>Try another search</h2>
            <p>No coach profile matches “{query}”. Try a different name, country, or city.</p>
            <button type="button" className="btn dark" onClick={() => setQuery("")}>Clear search</button>
          </div>
        ) : (
          filteredCoaches.map((coach) => (
            <article className="card hc-scout-card hc-team-row" key={coach.id}>
              <div className="hc-scout-card__report">
                <span>HoopCheck Scouting Report</span>
                <span>Directory profile</span>
              </div>
              <div className="hc-scout-card__identity">
                <span className="hc-scout-card__jersey" aria-hidden="true">{coach.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                <div className="hc-scout-card__identity-copy">
                  <h2>{coach.name}</h2>
                  <p>{coach.city && coach.country ? `${coach.city}, ${coach.country}` : coach.country || coach.city || "Location not listed"}</p>
                </div>
              </div>
              <div className="hc-scout-card__stats" aria-label="Coach review statistics; data not available in this directory listing">
                <div className="hc-scout-card__stat"><span>Overall rating</span><strong>—</strong><small>Not listed</small></div>
                <div className="hc-scout-card__stat"><span>Reviews</span><strong>—</strong><small>Not listed</small></div>
                <div className="hc-scout-card__stat"><span>Seasons tracked</span><strong>—</strong><small>Not listed</small></div>
              </div>
              <div className="hc-scout-card__ticket">
                <Link href={`/coaches/${coach.id}`} className="hc-scout-card__coach-link">View coach report <span aria-hidden="true">→</span></Link>
              </div>
            </article>
          ))
        )}
      </section>

      <CourtLines variant="circle" className="hc-court-divider-art" />

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
