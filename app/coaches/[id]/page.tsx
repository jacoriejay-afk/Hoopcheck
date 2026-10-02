"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { useParams } from "next/navigation";

import { supabase } from "../../../lib/supabase";

type Coach = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
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

export default function CoachDetailPage() {
  const params = useParams();

  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [coach, setCoach] =
    useState<Coach | null>(null);

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
    async function loadCoach() {
      if (!id) {
        setLoading(false);
        return;
      }

      const {
        data: coachData,
        error: coachError,
      } = await supabase
        .from("coaches")
        .select(
          "id, name, country, city"
        )
        .eq("id", id)
        .maybeSingle();

      if (
        coachError ||
        !coachData
      ) {
        setCoach(null);
        setLoading(false);
        return;
      }

      setCoach(coachData);

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

        supabase
          .from("admin_roles")
          .select("role")
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle(),
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
        adminResult.data?.role ===
          "admin" ||
        adminResult.data?.role ===
          "moderator";

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
            "coach_id",
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

    loadCoach();
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

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser();

    if (!user) {
      setReportMessage(
        "Please log in to report a review."
      );
      setReportLoading(false);
      return;
    }

    const {
      error,
    } = await supabase
      .from("review_reports")
      .insert({
        review_id: reportReviewId,
        reporter_id: user.id,
        reason: reportReason,
        status: "pending",
      });

    if (error) {
      console.error(
        "Error reporting review:",
        error
      );

      if (error.code === "23505") {
        setReportMessage(
          "You have already reported this review."
        );
      } else {
        setReportMessage(
          "Could not submit your report. Please try again."
        );
      }

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
            Loading coach...
          </h1>
        </section>
      </main>
    );
  }

  if (!coach) {
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
            Coach not found.
          </h1>

          <p>
            We couldn&apos;t find that coach
            in the HoopCheck database.
          </p>

          <div className="actions">
            <Link
              href="/coaches"
              className="btn"
            >
              Back To Coaches
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

          <Link href="/coaches">
            Coaches
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          Coach Research
        </div>

        <h1>
          {coach.name}
        </h1>

        <p>
          {coach.city &&
          coach.country
            ? `${coach.city}, ${coach.country}`
            : coach.country ||
              coach.city ||
              "Location not listed"}
        </p>

        <div className="actions">
          <Link
            href={`/coaches/${coach.id}/review`}
            className="btn"
          >
            Write A Review
          </Link>

          <Link
            href="/coaches"
            className="btn dark"
          >
            Back To Coaches
          </Link>
        </div>
      </section>

      {!hasAccess ? (
        <section className="hero">
          <div className="card">
            <div className="eyebrow">
              Members Only
            </div>

            <h2>
              Unlock the player
              experience.
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
                Coach Breakdown
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
                coach.
              </p>

              <Link
                href={`/coaches/${coach.id}/review`}
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
                  this coach.
                </p>

                <Link
                  href={`/coaches/${coach.id}/review`}
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

      <style jsx>{`
        .review-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-top: 18px;
          padding-top: 15px;
          border-top: 1px solid #292929;
        }

        .report-button {
          border: 0;
          background: transparent;
          color: #999;
          cursor: pointer;
          font-size: 0.78rem;
          font-weight: 800;
          transition: color 0.2s ease;
        }

        .report-button:hover {
          color: var(--orange);
        }

        .report-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0, 0, 0, 0.82);
          backdrop-filter: blur(6px);
        }

        .report-modal {
          width: min(100%, 520px);
          padding: 30px;
          border: 1px solid #333;
          border-top: 3px solid var(--orange);
          border-radius: 18px;
          background: #111;
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.55);
        }

        .report-modal h2 {
          margin-top: 0;
          margin-bottom: 10px;
        }

        .report-label {
          display: block;
          margin: 22px 0 8px;
          color: #aaa;
          font-size: 0.75rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .report-select {
          width: 100%;
          min-height: 48px;
          padding: 0 14px;
          border: 1px solid #333;
          border-radius: 10px;
          outline: none;
          background: #090909;
          color: #fff;
          font: inherit;
        }

        .report-select:focus {
          border-color: var(--orange);
        }

        .report-message {
          margin-top: 15px;
          padding: 12px 14px;
          border: 1px solid rgba(255, 106, 0, 0.3);
          border-radius: 10px;
          background: rgba(255, 106, 0, 0.08);
          color: #ddd;
          font-size: 0.88rem;
          line-height: 1.5;
        }

        .report-actions {
          margin-top: 22px;
        }

        @media (max-width: 600px) {
          .review-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .report-button {
            padding: 4px 0;
          }

          .report-modal {
            padding: 24px;
          }

          .report-actions {
            flex-direction: column;
          }

          .report-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
