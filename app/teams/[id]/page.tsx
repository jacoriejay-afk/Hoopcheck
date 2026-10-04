"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { useParams } from "next/navigation";

import { supabase } from "../../../lib/supabase";
import { submitReviewReport } from "../../../lib/review-reports";

type Team = {
  id: string;
  name: string;
  country: string | null;
  league_name: string | null;
  league_id: string | null;
  city: string | null;
};

type Coach = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
};

type League = {
  id: string;
  name: string;
  country: string | null;
  level: string | null;
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

export default function TeamDetailPage() {
  const params = useParams();

  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [team, setTeam] =
    useState<Team | null>(null);

  const [history, setHistory] = useState<any[]>([]);\n\n  const [league, setLeague] =
    useState<League | null>(null);

  const [coaches, setCoaches] =
    useState<Coach[]>([]);

  const [reviews, setReviews] =
    useState<Review[]>([]);

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
    async function loadTeam() {
      if (!id) {
        setLoading(false);
        return;
      }

      const {
        data: teamData,
        error: teamError,
      } = await supabase
        .from("teams")
        .select(
          "id, name, country, league_name, league_id, city"
        )
        .eq("id", id)
        .maybeSingle();

      if (
        teamError ||
        !teamData
      ) {
        setTeam(null);
        setLoading(false);
        return;
      }

      setTeam(teamData);\n\n      const { data: membershipData } = await supabase.from("team_league_memberships").select("id,league_id,season,start_date,end_date,active").eq("team_id", id).eq("active", true).order("season", { ascending: false });\n      if (membershipData) {\n        const leagueIds = membershipData.map((x) => x.league_id);\n        const { data: leagueRows } = leagueIds.length ? await supabase.from("leagues").select("id,name").in("id", leagueIds) : { data: [] as any[] };\n        setHistory(membershipData.map((x) => ({ ...x, league: leagueRows?.find((l) => l.id === x.league_id) })));\n      }

      const [leagueResult, coachesResult] =
        await Promise.all([
          teamData.league_id
            ? supabase
                .from("leagues")
                .select("id, name, country, level")
                .eq("id", teamData.league_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          supabase
            .from("coaches")
            .select("id, name, country, city")
            .eq("current_team_id", id)
            .eq("active", true)
            .order("name"),
        ]);

      if (!leagueResult.error && leagueResult.data) {
        setLeague(leagueResult.data);
      }

      if (!coachesResult.error && coachesResult.data) {
        setCoaches(coachesResult.data);
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
            "team_id",
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

        if (
          !reviewError &&
          reviewData
        ) {
          setReviews(
            reviewData
          );
        }

        setReviewLoading(false);
      }

      setLoading(false);
    }

    loadTeam();
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
            Loading team...
          </h1>
        </section>
      </main>
    );
  }

  if (!team) {
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
            Team not found.
          </h1>

          <p>
            We couldn&apos;t find that team
            in the HoopCheck database.
          </p>

          <div className="actions">
            <Link
              href="/teams"
              className="btn"
            >
              Back To Teams
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
          <Link href="/dashboard">
            Dashboard
          </Link>

          <Link href="/teams">
            Teams
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          Team Research
        </div>

        <h1>
          {team.name}
        </h1>

        <p>
          {team.city &&
          team.country
            ? `${team.city}, ${team.country}`
            : team.country ||
              team.city ||
              "Location not listed"}
        </p>

        {team.league_name && (
          <p
            style={{
              color: "var(--orange)",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              fontSize: "13px",
            }}
          >
            {team.league_name}
          </p>
        )}

        <div className="actions">
          <Link
            href={
              hasAccess
                ? `/teams/${team.id}/review`
                : "/membership"
            }
            className="btn"
          >
            {hasAccess
              ? "Write A Review"
              : "Become A Member To Review"}
          </Link>

          <Link
            href="/teams"
            className="btn dark"
          >
            Back To Teams
          </Link>
        </div>
      <section className="hero">\n        <div className="eyebrow">League History</div>\n        <h2>Competition history</h2>\n        {history.length ? <div className="grid" style={{ marginTop: "25px" }}>{history.map((item) => <div className="card" key={item.id}><div className="eyebrow">{item.season || "Season not listed"}</div><h3>{item.league?.name || "League not listed"}</h3><p>{item.start_date || "Start not listed"} → {item.end_date || "Present"}</p></div>)}</div> : <div className="card"><p>No historical league memberships have been added yet.</p></div>}\n      </section>\n\n      <section className="grid">
        <div className="card">
          <div className="eyebrow">League</div>
          {league ? (
            <>
              <h2>{league.name}</h2>
              <p>
                {league.country || "Country not listed"}
                {league.level ? " • " + league.level : ""}
              </p>
              <Link
                href={`/leagues/${league.id}`}
                className="btn"
              >
                View League
              </Link>
            </>
          ) : team.league_name ? (
            <>
              <h2>{team.league_name}</h2>
              <p>League relationship is being verified.</p>
              <Link href="/leagues" className="btn">
                Browse Leagues
              </Link>
            </>
          ) : (
            <>
              <h2>League not listed</h2>
              <p>HoopCheck has not linked this team to a league yet.</p>
            </>
          )}
        </div>

        <div className="card">
          <div className="eyebrow">Current Coaches</div>
          {coaches.length === 0 ? (
            <>
              <h2>No coaches listed yet.</h2>
              <p>HoopCheck has not linked a current coach to this team.</p>
            </>
          ) : (
            <>
              <h2>{coaches.length}</h2>
              <div style={{ display: "grid", gap: "10px", marginTop: "15px" }}>
                {coaches.slice(0, 6).map((coach) => (
                  <Link
                    key={coach.id}
                    href={`/coaches/${coach.id}`}
                    style={{
                      display: "block",
                      padding: "12px 14px",
                      border: "1px solid #333",
                      borderRadius: "10px",
                      textDecoration: "none",
                    }}
                  >
                    <strong>{coach.name}</strong>
                    <span
                      className="muted"
                      style={{ display: "block", marginTop: "4px", fontSize: "13px" }}
                    >
                      {coach.city && coach.country
                        ? coach.city + ", " + coach.country
                        : coach.country || coach.city || "Location not listed"}
                    </span>
                  </Link>
                ))}
              </div>
              {coaches.length > 6 && (
                <p className="muted">Showing 6 of {coaches.length} current coaches.</p>
              )}
            </>
          )}
        </div>
      </section>

      {!hasAccess ? (
        <section className="hero">
          <div className="card">
            <div className="eyebrow">
              Members Only
            </div>

            <h2>
              Know the organization
              before you sign.
            </h2>

            <p>
              HoopCheck ratings and approved
              player reviews are available to
              active members.
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

            <div className="card">
              <div className="eyebrow">
                Team Breakdown
              </div>

              {reviews.length === 0 ? (
                <p>
                  No approved reviews yet.
                </p>
              ) : (
                <>
                  <RatingBar
                    label="Communication"
                    value={
                      communication
                    }
                  />

                  <RatingBar
                    label="Professionalism"
                    value={
                      professionalism
                    }
                  />

                  <RatingBar
                    label="Development"
                    value={
                      development
                    }
                  />

                  <RatingBar
                    label="Payment"
                    value={payment}
                  />
                </>
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
                organization.
              </p>

              <Link
                href={`/teams/${team.id}/review`}
                className="btn"
              >
                Add Your Experience
              </Link>
            </div>
          </section>

          <section className="hero">
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
                  this organization.
                </p>

                <Link
                  href={`/teams/${team.id}/review`}
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
                            {review.title ||
                              "Player experience"}
                          </h3>
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
