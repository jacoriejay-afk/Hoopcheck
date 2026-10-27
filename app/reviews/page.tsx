"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import ReportContentAction from "../../components/ReportContentAction";

type ReviewRow = {
  id: string;
  status: string;
  title: string | null;
  body: string | null;
  overall_rating: number | null;
  created_at: string;
  author_id: string;
  coach_id: string | null;
  team_id: string | null;
  league_id: string | null;
};
type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  player_verified: boolean | null;
};
type Target = { id: string; name: string };
type ReviewCardData = ReviewRow & {
  author: ProfileRow | null;
  targetName: string;
  targetType: "Coaching" | "Teams" | "Leagues" | "Overall";
  targetHref: string | null;
};

const filters = ["All", "Overall", "Coaching", "Teams", "Leagues"] as const;
type Filter = (typeof filters)[number];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase() || "HC";
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="hc-review-stars" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(Math.max(0, Math.min(5, rating)))}
      <span style={{ color: "#d5d5d5" }}>
        {"★".repeat(Math.max(0, 5 - Math.min(5, rating)))}
      </span>
    </span>
  );
}

function readableDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently published"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ReviewsAnalyticsPage() {
  const [items, setItems] = useState<ReviewCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("reviews")
        .select("id,status,title,body,overall_rating,created_at,author_id,coach_id,team_id,league_id")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;
      if (error) {
        setErrorMessage("Published reviews could not be loaded right now. Please try again later.");
        setItems([]);
        setLoading(false);
        return;
      }

      const rows = (data || []) as ReviewRow[];
      const authorIds = Array.from(new Set(rows.map((row) => row.author_id).filter(Boolean)));
      const coachIds = Array.from(new Set(rows.map((row) => row.coach_id).filter(Boolean))) as string[];
      const teamIds = Array.from(new Set(rows.map((row) => row.team_id).filter(Boolean))) as string[];
      const leagueIds = Array.from(new Set(rows.map((row) => row.league_id).filter(Boolean))) as string[];

      const [profilesResult, coachesResult, teamsResult, leaguesResult] = await Promise.all([
        authorIds.length
          ? supabase.from("profiles").select("id,display_name,avatar_url,player_verified").in("id", authorIds)
          : Promise.resolve({ data: [], error: null }),
        coachIds.length
          ? supabase.from("coaches").select("id,name").in("id", coachIds)
          : Promise.resolve({ data: [], error: null }),
        teamIds.length
          ? supabase.from("teams").select("id,name").in("id", teamIds)
          : Promise.resolve({ data: [], error: null }),
        leagueIds.length
          ? supabase.from("leagues").select("id,name").in("id", leagueIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!active) return;

      const profileMap = new Map<string, ProfileRow>(
        ((profilesResult.data || []) as ProfileRow[]).map((profile) => [profile.id, profile])
      );
      const targetMap = new Map<string, string>();
      for (const target of [
        ...((coachesResult.data || []) as Target[]),
        ...((teamsResult.data || []) as Target[]),
        ...((leaguesResult.data || []) as Target[]),
      ]) {
        targetMap.set(target.id, target.name);
      }

      const mapped: ReviewCardData[] = rows.map((row) => {
        const targetType: ReviewCardData["targetType"] = row.coach_id
          ? "Coaching"
          : row.team_id
            ? "Teams"
            : row.league_id
              ? "Leagues"
              : "Overall";
        const targetId = row.coach_id || row.team_id || row.league_id;
        const targetHref = row.coach_id
          ? `/coaches/${row.coach_id}`
          : row.team_id
            ? `/teams/${row.team_id}`
            : row.league_id
              ? `/leagues/${row.league_id}`
              : null;
        return {
          ...row,
          author: profileMap.get(row.author_id) || null,
          targetType,
          targetName: targetId ? targetMap.get(targetId) || "Basketball listing" : "Overall experience",
          targetHref,
        };
      });

      setItems(mapped);
      setLoading(false);
    }

    void loadReviews();
    return () => {
      active = false;
    };
  }, []);

  const visibleItems = useMemo(
    () => filter === "All" ? items : items.filter((item) => item.targetType === filter),
    [filter, items]
  );

  const ratedItems = items.filter((item) =>
    typeof item.overall_rating === "number" && item.overall_rating >= 1 && item.overall_rating <= 5
  );
  const average = ratedItems.length
    ? ratedItems.reduce((sum, item) => sum + (item.overall_rating || 0), 0) / ratedItems.length
    : null;
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = ratedItems.filter((item) => item.overall_rating === stars).length;
    return {
      stars,
      count,
      percent: ratedItems.length ? Math.round((count / ratedItems.length) * 100) : 0,
    };
  });

  return (
    <main className="hc-reviews-page">
      <header>
        <p className="hc-review-kicker">HoopCheck reputation report</p>
        <h1 className="hc-review-page-title">Reviews &amp; Analytics</h1>
        <p className="hc-review-muted" style={{ marginTop: 8 }}>
          Published basketball experiences from the HoopCheck community.
        </p>
      </header>

      <section className="hc-review-summary" aria-label="Published review rating summary">
        <div>
          <div className="hc-review-score">{average === null ? "—" : average.toFixed(1)}</div>
          <Stars rating={average === null ? 0 : Math.round(average)} />
          <p className="hc-review-muted" style={{ marginTop: 7 }}>
            {ratedItems.length} published rating{ratedItems.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="hc-review-bars" aria-label="Rating distribution">
          {distribution.map((item) => (
            <div className="hc-review-bar-row" key={item.stars}>
              <span>{item.stars}</span>
              <div
                className="hc-review-bar-track"
                role="img"
                aria-label={`${item.stars} stars: ${item.percent} percent`}
              >
                <div className="hc-review-bar-fill" style={{ width: `${item.percent}%` }} />
              </div>
              <span style={{ textAlign: "right" }}>{item.percent}%</span>
            </div>
          ))}
        </div>
      </section>

      <div className="hc-review-filters" aria-label="Filter reviews">
        {filters.map((option) => (
          <button
            key={option}
            type="button"
            className="hc-review-filter"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <section aria-label="Published review timeline">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".04em" }}>
            Latest feedback
          </h2>
          <span className="hc-review-muted">Latest {items.length} published</span>
        </div>

        {loading ? (
          <div className="hc-review-state">Loading published reviews…</div>
        ) : errorMessage ? (
          <div className="hc-review-state">{errorMessage}</div>
        ) : visibleItems.length === 0 ? (
          <div className="hc-review-state">
            No published reviews are available for this filter yet.
          </div>
        ) : (
          <div className="hc-review-feed">
            {visibleItems.map((item) => {
              const authorName = item.author?.display_name?.trim() || "HoopCheck member";
              const rating = item.overall_rating && item.overall_rating >= 1 && item.overall_rating <= 5
                ? item.overall_rating
                : 0;
              return (
                <article className="hc-review-card" key={item.id}>
                  <div className="hc-review-card-head">
                    {item.author?.avatar_url ? (
                      // Public avatar URL comes from the profile record.
                      <img
                        src={item.author.avatar_url}
                        alt=""
                        className="hc-review-avatar"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div className="hc-review-avatar" aria-hidden="true">{initials(authorName)}</div>
                    )}
                    <div className="hc-review-author">
                      <strong>{authorName}</strong>
                      <small>
                        {item.author?.player_verified ? "Verified player · " : ""}
                        {readableDate(item.created_at)}
                      </small>
                    </div>
                    <span className="hc-review-tag">{item.targetType}</span>
                  </div>
                  {rating > 0 && <Stars rating={rating} />}
                  {item.title && (
                    <h3 style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 900, lineHeight: 1.35 }}>
                      {item.title}
                    </h3>
                  )}
                  {item.body && <p className="hc-review-body">{item.body}</p>}
                  <p className="hc-review-target">
                    {item.targetHref ? (
                      <Link href={item.targetHref} style={{ color: "#ff5500", fontWeight: 800 }}>
                        {item.targetName} →
                      </Link>
                    ) : item.targetName}
                  </p>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><ReportContentAction contentType="review" contentId={item.id} contentSnapshot={[item.title, item.body].filter(Boolean).join("\n")} /></div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
