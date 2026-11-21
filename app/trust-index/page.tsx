"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "../../components/LayoutSystem";
import TrustScoreDial from "../../components/TrustScoreDial";
import { supabase } from "../../lib/supabase";
import "./trust-index.css";

type Kind = "team" | "womens-team";
type Team = { id: string; name: string; country: string | null; city: string | null; league_name: string | null };
type Trust = { score: number | null; locked?: boolean; reviewCount: number | null; verifiedReviewCount: number | null; explanation: string | null; averageRating: number | null };
type Sort = "name" | "score" | "reviews";
const PAGE_SIZE = 24;

/** Review-backed comparisons only. This is not a financial or contract guarantee. */
export default function TrustIndexPage() {
  const [kind, setKind] = useState<Kind>("team");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("score");
  const [teams, setTeams] = useState<Team[]>([]);
  const [scores, setScores] = useState<Record<string, Trust>>({});
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setStatus("loading");
        try {
          const table = kind === "team" ? "teams" : "womens_teams";
          let request = supabase.from(table)
            .select("id,name,country,city,league_name")
            .eq("active", true).order("name").order("id").limit(PAGE_SIZE + 1);
          if (kind === "team") request = request.eq("basketball_type", "mens");
          const term = query.trim().slice(0, 80).replace(/[\\%_]/g, char => "\\" + char);
          if (term) request = request.ilike("name", `%${term}%`);
          const { data, error } = await request;
          if (error) throw error;
          const shown = (data || []).slice(0, PAGE_SIZE) as Team[];
          if (!active) return;
          setTeams(shown);
          setHasMore(Boolean(data && data.length > PAGE_SIZE));
          setScores({});
          if (!shown.length) { setStatus("ready"); return; }

          // The existing API already verifies membership and applies the
          // established paywall. Never fetch private review text in the browser.
          const { data: { session } } = await supabase.auth.getSession();
          const params = new URLSearchParams({
            entityType: kind,
            entityIds: shown.map(team => team.id).join(","),
          });
          const response = await fetch(`/api/trust-score?${params}`, {
            headers: session?.access_token ? { Authorization: "Bearer " + session.access_token } : {},
            cache: "no-store",
          });
          if (!response.ok) throw Error("Trust API unavailable");
          const result: { scores?: Record<string, Trust> } = await response.json();
          if (!result.scores) throw Error("Invalid trust response");
          if (!active) return;
          setScores(result.scores);
          setLocked(shown.every(team => result.scores?.[team.id]?.locked === true));
          setStatus("ready");
        } catch {
          if (active) { setStatus("error"); setScores({}); }
        }
      })();
    }, 260);
    return () => { active = false; window.clearTimeout(timer); };
  }, [kind, query]);

  const ordered = useMemo(() => {
    const rows = [...teams];
    if (sort === "name") return rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows.sort((a, b) => {
      const va = scores[a.id], vb = scores[b.id];
      const aValue = sort === "score" ? va?.score : va?.reviewCount;
      const bValue = sort === "score" ? vb?.score : vb?.reviewCount;
      return (bValue ?? -1) - (aValue ?? -1) || a.name.localeCompare(b.name);
    });
  }, [teams, scores, sort]);

  return <PageShell><main className="hc-index-page">
    <header className="hc-index-intro">
      <p className="hc-index-kicker">HOOPCHECK™ / PLAYER INTELLIGENCE</p>
      <h1>Team Trust Index<span>.</span></h1>
      <p>Compare published player-review evidence, verification and recent feedback. The score is an indicator, not a guarantee of pay, contracts or safety.</p>
    </header>
    <section className="hc-index-controls" aria-label="Find teams to compare">
      <div className="hc-index-pills" role="group" aria-label="Basketball category">
        <button type="button" aria-pressed={kind === "team"} onClick={() => setKind("team")}>Men's clubs</button>
        <button type="button" aria-pressed={kind === "womens-team"} onClick={() => setKind("womens-team")}>Women's clubs</button>
      </div>
      <label>Find a club
        <input type="search" placeholder="Search by team name" maxLength={80} value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <label>Sort displayed results
        <select value={sort} onChange={event => setSort(event.target.value as Sort)}>
          <option value="score">Highest review-based score</option>
          <option value="reviews">Most published reviews</option>
          <option value="name">A to Z</option>
        </select>
      </label>
    </section>
    <p className="hc-index-note">Results are limited to the first {PAGE_SIZE} matching clubs; sorting applies only to those results, not a worldwide ranking. Club score availability depends on your membership and sufficient approved reviews.</p>
    {status === "loading" && <p role="status" className="hc-index-status">Checking club review data…</p>}
    {status === "error" && <div className="hc-index-status" role="alert">Trust data is unavailable. <button type="button" onClick={() => setQuery(current => current + " ")}>Try again</button></div>}
    {status === "ready" && <>
      {locked && <div className="hc-index-gate"><strong>Unlock verified Trust Scores</strong><p>Your membership does not currently include this evidence. Club names remain browseable.</p><Link href="/membership">See membership access</Link></div>}
      <section aria-label="Team trust comparisons" className="hc-index-grid">
        {ordered.map(team => {
          const trust = scores[team.id];
          const restricted = !trust || trust.locked;
          return <article className="hc-index-team" key={team.id}>
            <div className="hc-index-team-head"><div><h2><Link href={`/${kind === "team" ? "teams" : "womens"}/${team.id}`}>{team.name}</Link></h2>
              <p>{[team.city, team.country].filter(Boolean).join(", ") || "Location not listed"}</p>
              {team.league_name && <small>{team.league_name}</small>}</div>
              {restricted ? <span className="hc-index-locked">Member insight</span> : <TrustScoreDial size="mini" score={trust.score} explanation={trust.explanation || ""} reviewCount={trust.reviewCount || 0} verifiedReviewCount={trust.verifiedReviewCount || 0} />}
            </div>
            {!restricted && <p className="hc-index-context">{trust.reviewCount || 0} published · {trust.verifiedReviewCount || 0} verified-player reviews{trust.score === null ? " · Insufficient data to score" : ""}</p>}
          </article>;
        })}
      </section>
      {!ordered.length && <div className="hc-index-status">No matching clubs. Try another team name.</div>}
      {hasMore && <p className="hc-index-note">More matching clubs exist. Narrow your search to find a specific team.</p>}
    </>}
    <footer className="hc-index-links"><Link href="/teams">Men's teams</Link><Link href="/womens">Women's teams</Link><Link href="/feed">HoopFeed</Link></footer>
  </main></PageShell>;
}
