"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { useParams } from "next/navigation";

import { supabase } from "../../../lib/supabase";
import { submitReviewReport } from "../../../lib/review-reports";

type League = {
  id: string;
  name: string;
  country: string | null;
  level: string | null;
};

type Team = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  league_id: string | null;
};

type ReviewVerification = {
  review_id: string;
  player_verified: boolean | null;
};

type Review = {
  id: string;
  overall_rating: number;
  communication_rating: number | null;
  professionalism_rating: number | null;
  development_rating: number | null;
  payment_rating: number | null;
  title: string | null;
  body: string;
  created_at: string;
  player_verified?: boolean;
};

function RatingBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const percentage = Math.max(
    0,
    Math.min(100, (value / 5) * 100)
  );

  return (
    <div
      style={{
        marginBottom: "18px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "7px",
          fontSize: "13px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.4px",
        }}
      >
        <span>{label}</span>

        <span
          style={{
            color: "var(--orange)",
          }}
        >
          {value.toFixed(1)}
        </span>
      </div>

      <div
        style={{
          height: "8px",
          background: "#252525",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: "var(--orange)",
            borderRadius: "999px",
          }}
        />
      </div>
    </div>
  );
}

export default function LeagueDetailPage() {
  const params = useParams();

  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [league, setLeague] =
    useState<League | null>(null);

  const [reviews, setReviews] =
    useState<Review[]>([]);

  const [publicSummary, setPublicSummary] = useState({
    review_count: 0,
    overall_rating: null as number | null,
    communication_rating: null as number | null,
    professionalism_rating: null as number | null,
    development_rating: null as number | null,
    payment_rating: null as number | null,
  });

  const [teams, setTeams] =
    useState<Team[]>([]);

  const [teamHistory, setTeamHistory] = useState<any[]>([]);

  const [hasAccess, setHasAccess] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [reviewLoading, setReviewLoading] =
    useState(false);

  const [reportReviewId, setReportReviewId] =
    useState<string | null>(null);

  const [reportReason, setReportReason] =
    useState("");

  const [reportLoading, setReportLoading] =
    useState(false);

  const [reportMessage, setReportMessage] =
    useState("");

  useEffect(() => {
    async function loadLeague() {
      if (!id) {
        setLoading(false);
        return;
      }

      const {
        data: leagueData,
        error: leagueError,
      } = await supabase
        .from("leagues")
        .select(
          "id, name, country, level"
        )
        .eq("id", id)
        .maybeSingle();

      if (
        leagueError ||
        !leagueData
      ) {
        setLeague(null);
        setLoading(false);
        return;
      }

      setLeague(leagueData);

      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("id, name, country, city, league_id")
        .eq("league_id", id)
        .eq("active", true)
        .order("name");

      if (!teamError && teamData) {
        setTeams(teamData);
        const { data: membershipRows } = await supabase.from("team_league_memberships").select("id,team_id,season,start_date,end_date,active").eq("league_id", id).eq("active", true).order("season", { ascending: false });
        if (membershipRows) {
          const ids = membershipRows.map((x) => x.team_id);
          const { data: rows } = ids.length ? await supabase.from("teams").select("id,name").in("id", ids) : { data: [] as any[] };
          setTeamHistory(membershipRows.map((x) => ({ ...x, team: rows?.find((t) => t.id === x.team_id) })));
        }

      const teamIds = teamData.map((x) => x.id);
      if (teamIds.length) {
        const { data: membershipRows } = await supabase.from("team_league_memberships").select("team_id,season,active").eq("league_id", id).eq("active", true);
        const currentTeamIds = new Set((membershipRows || []).map((x) => x.team_id));
        setTeams(teamData.filter((x) => currentTeamIds.has(x.id)));
      }
      }

      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const [
        subscriptionResult,
        adminResult,
      ] = await Promise.all([
        supabase
          .from("subscriptions")
          .select(
            "status, current_period_end"
          )
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle(),

        supabase.rpc(
          "is_current_user_admin_or_moderator"
        ),
      ]);

      const subscription =
        subscriptionResult.data;

      const currentPeriodEnd =
        subscription?.current_period_end
          ? new Date(
              subscription.current_period_end
            )
          : null;

      const subscriptionIsActive =
        (
          subscription?.status ===
            "active" ||
          subscription?.status ===
            "trialing"
        ) &&
        (
          !currentPeriodEnd ||
          currentPeriodEnd >
            new Date()
        );

      const isAdmin =
        adminResult.data === true;

      const access =
        subscriptionIsActive ||
        isAdmin;

      setHasAccess(access);

      const { data: summaryData, error: summaryError } =
        await supabase.rpc("get_public_review_summary", {
          p_entity_type: "league",
          p_entity_id: id,
        });

      if (!summaryError && summaryData?.[0]) {
        setPublicSummary({
          review_count: Number(summaryData[0].review_count || 0),
          overall_rating: summaryData[0].overall_rating == null ? null : Number(summaryData[0].overall_rating),
          communication_rating: summaryData[0].communication_rating == null ? null : Number(summaryData[0].communication_rating),
          professionalism_rating: summaryData[0].professionalism_rating == null ? null : Number(summaryData[0].professionalism_rating),
          development_rating: summaryData[0].development_rating == null ? null : Number(summaryData[0].development_rating),
          payment_rating: summaryData[0].payment_rating == null ? null : Number(summaryData[0].payment_rating),
        });
      } else if (summaryError) {
        console.error("Public review summary error:", summaryError);
      }

      if (access) {
        setReviewLoading(true);

        const {
          data: reviewData,
          error: reviewError,
        } = await supabase
          .from("reviews")
          .select(
            `
              id,
              overall_rating,
              communication_rating,
              professionalism_rating,
              development_rating,
              payment_rating,
              title,
              body,
              created_at
            `
          )
          .eq(
            "league_id",
            id
          )
          .eq(
            "status",
            "approved"
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          );

        if (!reviewError && reviewData) {
          const reviewIds = reviewData.map((review) => review.id);
          const { data: verificationData } = await supabase.rpc("get_review_verification", { p_review_ids: reviewIds });
          const verifiedByReview = Object.fromEntries((verificationData as ReviewVerification[] | null || []).map((item) => [item.review_id, Boolean(item.player_verified)]));
          setReviews(reviewData.map((review) => ({ ...review, player_verified: verifiedByReview[review.id] || false })));
        }

        setReviewLoading(false);
      }

      setLoading(false);
    }

    loadLeague();
  }, [id]);

  async function submitReport() {
    if (!reportReviewId) {
      return;
    }

    if (!reportReason) {
      setReportMessage(
        "Please select a reason for reporting this review."
      );
      return;
    }

    setReportLoading(true);
    setReportMessage("");

    const result = await submitReviewReport(
      reportReviewId,
      reportReason
    );

    if (!result.success) {
      setReportMessage(result.message);
      setReportLoading(false);
      return;
    }

    setReportMessage(
      "Report submitted. Our moderation team will review it."
    );

    setReportLoading(false);
  }

  function closeReportModal() {
    if (reportLoading) {
      return;
    }

    setReportReviewId(null);
    setReportReason("");
    setReportMessage("");
  }

  if (loading) {
    return (
      <main>
        <nav className="nav">
          <Link
            href="/"
            className="logo"
          >
            Hoop<span>Check</span>
          </Link>
        </nav>

        <section className="hero">
          <div className="eyebrow">
            HoopCheck
          </div>

          <h1>
            Loading league...
          </h1>
        </section>
      </main>
    );
  }

  if (!league) {
    return (
      <main>
        <nav className="nav">
          <Link
            href="/"
            className="logo"
          >
            Hoop<span>Check</span>
          </Link>
        </nav>

        <section className="hero">
          <div className="eyebrow">
            404
          </div>

          <h1>
            League not found.
          </h1>

          <p>
            We couldn&apos;t find that league
            in the HoopCheck database.
          </p>

          <div className="actions">
            <Link
              href="/leagues"
              className="btn"
            >
              Back To Leagues
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const average =
    reviews.length > 0
      ? reviews.reduce(
          (
            total,
            review
          ) =>
            total +
            Number(
              review.overall_rating
            ),
          0
        ) / reviews.length
      : 0;

  const communication =
    reviews.length > 0
      ? reviews.reduce(
          (
            total,
            review
          ) =>
            total +
            Number(
              review.communication_rating ||
                0
            ),
          0
        ) / reviews.length
      : 0;

  const professionalism =
    reviews.length > 0
      ? reviews.reduce(
          (
            total,
            review
          ) =>
            total +
            Number(
              review.professionalism_rating ||
                0
            ),
          0
        ) / reviews.length
      : 0;

  const development =
    reviews.length > 0
      ? reviews.reduce(
          (
            total,
            review
          ) =>
            total +
            Number(
              review.development_rating ||
                0
            ),
          0
        ) / reviews.length
      : 0;

  const payment =
    reviews.length > 0
      ? reviews.reduce(
          (
            total,
            review
          ) =>
            total +
            Number(
              review.payment_rating ||
                0
            ),
          0
        ) / reviews.length
      : 0;

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
          <Link href="/dashboard">
            Dashboard
          </Link>

          <Link href="/leagues">
            Leagues
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          League Research
        </div>

        <h1>
          {league.name}
        </h1>

        <p>
          {league.country ||
            "Country not listed"}
        </p>

        {league.level && (
          <p
            style={{
              color: "var(--orange)",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              fontSize: "13px",
            }}
          >
            {league.level}
          </p>
        )}

        <div className="actions">
          <Link
            href={
              hasAccess
                ? `/leagues/${league.id}/review`
                : "/membership"
            }
            className="btn"
          >
            {hasAccess
              ? "Write A Review"
              : "Become A Member To Review"}
          </Link>

          <Link
            href="/leagues"
            className="btn dark"
          >
            Back To Leagues
          </Link>
        </div>
      </section>

      <section className="hero">
        <div className="eyebrow">Team Membership History</div>
        <h2>Teams by season</h2>
        {teamHistory.length ? <div className="grid" style={{ marginTop: "25px" }}>{teamHistory.map((item) => <div className="card" key={item.id}><div className="eyebrow">{item.season || "Season not listed"}</div><h3>{item.team?.name || "Team not listed"}</h3><p>{item.start_date || "Start not listed"} → {item.end_date || "Present"}</p></div>)}</div> : <div className="card"><p>No historical team memberships have been added yet.</p></div>}
      </section>

      <section className="hero">
        <div className="eyebrow">Teams In This League</div>
        <h2>Professional organizations</h2>
        <p>
          {teams.length > 0
            ? teams.length + " active team" + (teams.length === 1 ? "" : "s") + " currently linked to this league."
            : "No active teams are linked to this league yet."}
        </p>

        {teams.length > 0 && (
          <div className="grid" style={{ marginTop: "30px" }}>
            {teams.map((team) => (
              <Link
                key={team.id}
                href={"/teams/" + team.id}
                className="card"
                style={{ textDecoration: "none" }}
              >
                <div className="eyebrow">TEAM</div>
                <h3>{team.name}</h3>
                <p>
                  {team.city && team.country
                    ? team.city + ", " + team.country
                    : team.country || team.city || "Location not listed"}
                </p>
                <span className="btn">View Team</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {!hasAccess && (
        <section className="grid">
          <div className="card">
            <div className="eyebrow">Community Rating</div>
            <h2 style={{ fontSize: "58px", color: "var(--orange)", marginBottom: "4px" }}>
              {publicSummary.overall_rating == null ? "—" : publicSummary.overall_rating.toFixed(1)}
            </h2>
            <p>
              Based on {publicSummary.review_count} approved {publicSummary.review_count === 1 ? "review" : "reviews"}.
            </p>
          </div>

          <div className="card">
            <div className="eyebrow">Rating Breakdown</div>
            {publicSummary.review_count === 0 ? (
              <p>No approved reviews yet.</p>
            ) : (
              <>
                {publicSummary.communication_rating != null && <RatingBar label="Communication" value={publicSummary.communication_rating} />}
                {publicSummary.professionalism_rating != null && <RatingBar label="Professionalism" value={publicSummary.professionalism_rating} />}
                {publicSummary.development_rating != null && <RatingBar label="Development" value={publicSummary.development_rating} />}
                {publicSummary.payment_rating != null && <RatingBar label="Payment" value={publicSummary.payment_rating} />}
              </>
            )}
          </div>

          <div className="card">
            <div className="eyebrow">Full Reviews</div>
            <h3>See what players are saying.</h3>
            <p>Subscribe to unlock the complete approved review library and player experiences.</p>
            <Link href="/membership" className="btn">Unlock Full Reviews</Link>
          </div>
        </section>
      )}

      {!hasAccess ? (
        <section className="hero">
          <div className="card">
            <div className="eyebrow">
              Members Only
            </div>

            <h2>
              Know the league
              before you commit.
            </h2>

            <p>
              Research the league before your next move. Membership starts at $7.99/month and can be managed through Stripe anytime.
            </p>

            <div className="actions">
              <Link
                href="/membership"
                className="btn"
              >
                View Membership
              </Link>

              <Link
                href="/login"
                className="btn dark"
              >
                Log In
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="grid">
            <div className="card">
              <div className="eyebrow">
                Overall Rating
              </div>

              <h2
                style={{
                  fontSize: "58px",
                  color:
                    "var(--orange)",
                  marginBottom:
                    "4px",
                }}
              >
                {average.toFixed(1)}
              </h2>

              <p>
                Based on{" "}
                {reviews.length}{" "}
                approved{" "}
                {reviews.length === 1
                  ? "review"
                  : "reviews"}
                .
              </p>
            </div>

            <div className="card" style={{ position: "relative", overflow: "hidden" }}>
              <div className="eyebrow">League Breakdown</div>
              {hasAccess ? (
                reviews.length === 0 ? <p>No approved reviews yet.</p> : <>
                  <RatingBar label="Communication" value={communication} />
                  <RatingBar label="Professionalism" value={professionalism} />
                  <RatingBar label="Development" value={development} />
                  <RatingBar label="Payment" value={payment} />
                </>
              ) : (
                <div style={{ padding: "24px 0" }}>
                  <div style={{ filter: "blur(7px)", opacity: 0.35, pointerEvents: "none" }}>
                    <div style={{ height: 16, width: "75%", background: "#555", borderRadius: 8, marginBottom: 14 }} />
                    <div style={{ height: 16, width: "60%", background: "#555", borderRadius: 8, marginBottom: 14 }} />
                    <div style={{ height: 16, width: "68%", background: "#555", borderRadius: 8 }} />
                  </div>
                  <div style={{ marginTop: -58, textAlign: "center", position: "relative" }}>
                    <strong>Ratings locked</strong>
                    <p className="muted">Create a free account, then unlock full ratings with membership.</p>
                    <div className="actions"><Link href="/signup" className="btn">Create Free Account</Link><Link href="/membership" className="btn dark">Unlock Ratings</Link></div>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="eyebrow">
                Player Feedback
              </div>

              <h2>
                {reviews.length}
              </h2>

              <p>
                Approved player experiences
                currently available for this
                league.
              </p>

              <Link
                href={`/leagues/${league.id}/review`}
                className="btn"
              >
                Add Your Experience
              </Link>
            </div>
          </section>

          <section className="hero">
            {!hasAccess && (
              <div className="card" style={{ marginBottom: 24, borderColor: "rgba(255,106,0,.45)" }}>
                <div className="eyebrow">Members Only</div>
                <h3>Player reviews are locked</h3>
                <p>{publicSummary.review_count || 0} approved player review{publicSummary.review_count === 1 ? "" : "s"} are available for this profile. Create a free account to see the locked review section and membership options.</p>
                <div className="actions">
                  <Link href="/signup" className="btn">Create Free Account</Link>
                  <Link href="/login" className="btn dark">Log In</Link>
                </div>
              </div>
            )}
            <div className="eyebrow">
              Approved Reviews
            </div>

            <h2>
              What players
              <br />
              are saying.
            </h2>

            {reviewLoading ? (
              <p>
                Loading reviews...
              </p>
            ) : reviews.length ===
              0 ? (
              <div className="card">
                <h3>
                  No approved reviews yet.
                </h3>

                <p>
                  Be one of the first players
                  to share an experience with
                  this league.
                </p>

                <Link
                  href={`/leagues/${league.id}/review`}
                  className="btn"
                >
                  Write A Review
                </Link>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "18px",
                  marginTop: "30px",
                }}
              >
                {reviews.map(
                  (review) => (
                    <article
                      className="card"
                      key={review.id}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          gap: "12px",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <div>
                          <div className="eyebrow">
                            Player Review
                          </div>

                          <h3>
                            {review.title || "Player experience"}
                          </h3>
                          {review.player_verified && (
                            <div style={{ marginTop: "6px", fontSize: "12px", fontWeight: 800, color: "var(--orange)" }}>
                              ✓ Verified Player
                            </div>
                          )}
                        </div>

                        <strong
                          style={{
                            color:
                              "var(--orange)",
                            fontSize:
                              "24px",
                          }}
                        >
                          {Number(
                            review.overall_rating
                          ).toFixed(1)}
                        </strong>
                      </div>

                      <p>
                        {review.body}
                      </p>

                      <div className="review-footer">
                        <p
                          className="muted"
                          style={{
                            fontSize:
                              "13px",
                            margin: 0,
                          }}
                        >
                          {new Date(
                            review.created_at
                          ).toLocaleDateString()}
                        </p>

                        <button
                          type="button"
                          className="report-button"
                          onClick={() => {
                            setReportReviewId(
                              review.id
                            );
                            setReportReason("");
                            setReportMessage("");
                          }}
                        >
                          🚩 Report Review
                        </button>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        </>
      )}

      {reportReviewId && (
        <div
          className="report-overlay"
          onClick={closeReportModal}
        >
          <div
            className="report-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="eyebrow">
              Review Safety
            </div>

            <h2>
              Report this review
            </h2>

            <p className="muted">
              Tell the HoopCheck moderation team
              why this review should be reviewed.
            </p>

            <label
              htmlFor="report-reason"
              className="report-label"
            >
              Reason
            </label>

            <select
              id="report-reason"
              value={reportReason}
              onChange={(event) =>
                setReportReason(
                  event.target.value
                )
              }
              disabled={reportLoading}
              className="report-select"
            >
              <option value="">
                Select a reason
              </option>

              <option value="Spam or advertising">
                Spam or advertising
              </option>

              <option value="Harassment or abusive content">
                Harassment or abusive content
              </option>

              <option value="False or misleading information">
                False or misleading information
              </option>

              <option value="Personal information">
                Personal information
              </option>

              <option value="Threats or dangerous content">
                Threats or dangerous content
              </option>

              <option value="Other">
                Other
              </option>
            </select>

            {reportMessage && (
              <div className="report-message">
                {reportMessage}
              </div>
            )}

            <div className="actions report-actions">
              <button
                type="button"
                className="btn"
                onClick={submitReport}
                disabled={reportLoading}
              >
                {reportLoading
                  ? "Submitting..."
                  : "Submit Report"}
              </button>

              <button
                type="button"
                className="btn dark"
                onClick={closeReportModal}
                disabled={reportLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
