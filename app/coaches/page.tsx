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
import CourtLines from "../../components/CourtLines";
import TrustScoreDial from "../../components/TrustScoreDial";

type Coach = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
};

type TrustSummary = { score: number | null; reviewCount: number; verifiedReviewCount: number; explanation: string; averageRating: number | null };

export default function CoachesPage() {
  const [coaches, setCoaches] =
    useState<Coach[]>([]);
  const [trustScores, setTrustScores] = useState<Record<string, TrustSummary>>({});

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

  useEffect(() => {
    if (!coaches.length) { setTrustScores({}); return; }
    let active = true;
    const ids = coaches.map(coach => coach.id);
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/trust-score?entityType=coach&entityIds=${ids.map(encodeURIComponent).join(",")}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}, cache: "no-store",
      });
      const payload = response.ok ? await response.json() : null;
      if (active && payload?.scores) setTrustScores(payload.scores as Record<string, TrustSummary>);
    })().catch(() => { if (active) setTrustScores({}); });
    return () => { active = false; };
  }, [coaches]);

  return (
    <main className="hc-coaches-directory-page">
<DirectoryLayout current="coaches" />

      <section className="hc-coach-directory-tools" aria-label="Search coaches">
        <label htmlFor="coach-directory-search">Find a coach</label>
        <SearchBar inputId="coach-directory-search" value={query} onChange={setQuery} placeholder="Search players, coaches, teams, or leagues" ariaLabel="Search coaches" onSubmit={setQuery} />
        <div className="hc-coach-directory-summary" aria-live="polite">
          {loading ? "Searching coaching profiles…" : `${filteredCoaches.length.toLocaleString()} coach${filteredCoaches.length === 1 ? "" : "es"}`}
          {query && <button type="button" className="hc-directory-reset" onClick={() => setQuery("")}>Clear filters</button>}
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
              {trustScores[coach.id] && <div className="hc-team-directory-row__trust"><TrustScoreDial score={trustScores[coach.id].score} explanation={trustScores[coach.id].explanation} reviewCount={trustScores[coach.id].reviewCount} verifiedReviewCount={trustScores[coach.id].verifiedReviewCount} size="mini" /></div>}
              <div className="hc-scout-card__stats" aria-label="Coach review statistics">
                <div className="hc-scout-card__stat"><span>Overall rating</span><strong>{trustScores[coach.id]?.averageRating == null ? "—" : trustScores[coach.id].averageRating!.toFixed(1)}</strong><small>{trustScores[coach.id]?.averageRating == null ? "Not available" : "Out of 5"}</small></div>
                <div className="hc-scout-card__stat"><span>Reviews</span><strong>{trustScores[coach.id]?.reviewCount ?? "—"}</strong><small>Approved reviews</small></div>
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
