"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import { supabase } from "../../../../lib/supabase";

type League = {
  id: string;
  name: string;
  country: string | null;
  level: string | null;
};

type RatingFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function RatingField({
  label,
  value,
  onChange,
}: RatingFieldProps) {
  return (
    <div
      style={{
        padding: "20px",
        border: "1px solid #252525",
        borderRadius: "10px",
        background: "#0d0d0d",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.7px",
          marginBottom: "12px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            aria-label={`Rate ${label} ${rating} out of 5`}
            aria-pressed={value === rating}
            onClick={() => onChange(rating)}
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "8px",
              border:
                value === rating
                  ? "2px solid var(--orange)"
                  : "1px solid #333",
              background:
                value === rating
                  ? "var(--orange)"
                  : "#171717",
              color:
                value === rating
                  ? "#000"
                  : "#fff",
              fontWeight: 900,
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LeagueReviewPage() {
  const params = useParams();

  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [league, setLeague] =
    useState<League | null>(null);

  const [overall, setOverall] =
    useState(0);

  const [communication, setCommunication] =
    useState(0);

  const [professionalism, setProfessionalism] =
    useState(0);

  const [development, setDevelopment] =
    useState(0);

  const [payment, setPayment] =
    useState(0);

  const [title, setTitle] =
    useState("");

  const [body, setBody] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [alreadyReviewed, setAlreadyReviewed] =
    useState(false);

  useEffect(() => {
    async function loadPage() {
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

      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
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

      if (
        !subscriptionIsActive &&
        !isAdmin
      ) {
        setMessage(
          "An active HoopCheck membership is required to submit a review."
        );

        setLoading(false);
        return;
      }

      const {
        data: existingReview,
        error: existingReviewError,
      } = await supabase
        .from("reviews")
        .select("id")
        .eq(
          "author_id",
          user.id
        )
        .eq(
          "league_id",
          id
        )
        .maybeSingle();

      if (existingReviewError) {
        console.error(
          "Existing review check error:",
          existingReviewError
        );
      }

      if (existingReview) {
        setAlreadyReviewed(true);
      }

      setLoading(false);
    }

    loadPage();
  }, [id]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    if (
      overall < 1 ||
      communication < 1 ||
      professionalism < 1 ||
      development < 1 ||
      payment < 1
    ) {
      setMessage(
        "Please rate every category."
      );
      return;
    }

    const trimmedTitle =
      title.trim();

    const trimmedBody =
      body.trim();

    if (
      trimmedTitle.length > 0 &&
      (
        trimmedTitle.length < 3 ||
        trimmedTitle.length > 120
      )
    ) {
      setMessage(
        "Your title must be between 3 and 120 characters."
      );
      return;
    }

    if (
      trimmedBody.length < 20 ||
      trimmedBody.length > 5000
    ) {
      setMessage(
        "Your review must be between 20 and 5,000 characters."
      );
      return;
    }

    setSubmitting(true);

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage(
        "Please log in before submitting a review."
      );

      setSubmitting(false);
      return;
    }

    /*
     * Database RLS remains the final security layer.
     *
     * The insert must satisfy:
     * - author_id = authenticated user
     * - status = pending
     * - active/trialing subscription OR admin/moderator
     */
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setMessage("Your session expired. Please log in again.");
      setSubmitting(false);
      return;
    }

    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        league_id: id,
        overall_rating: overall,
        communication_rating: communication,
        professionalism_rating: professionalism,
        development_rating: development,
        payment_rating: payment,
        title: trimmedTitle || null,
        body: trimmedBody,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 409 || result?.error?.includes("already")) {
        setMessage("You have already submitted a review for this league.");
      } else if (response.status === 401 || response.status === 403) {
        setMessage(result?.error || "An active HoopCheck membership is required to submit a review.");
      } else {
        console.error("Review submission error:", result);
        setMessage(result?.error || "Unable to submit your review.");
      }
      setSubmitting(false);
      return;
    }

    setMessage(
      "Review submitted. It will appear after moderation."
    );

    setTimeout(() => {
      window.location.href =
        `/leagues/${id}`;
    }, 1500);
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
            Loading review form...
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

          <Link
            href="/leagues"
            className="btn"
          >
            Back To Leagues
          </Link>
        </section>
      </main>
    );
  }

  if (alreadyReviewed) {
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
            Already Submitted
          </div>

          <h1>
            You already reviewed
            <br />
            {league.name}.
          </h1>

          <p>
            HoopCheck allows one review per
            player for each league.
          </p>

          <div className="actions">
            <Link
              href={`/leagues/${league.id}`}
              className="btn"
            >
              View League
            </Link>

            <Link
              href="/leagues"
              className="btn dark"
            >
              Back To Leagues
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (
    message.startsWith(
      "An active HoopCheck"
    )
  ) {
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
            Members Only
          </div>

          <h1>
            Membership required.
          </h1>

          <p>
            An active HoopCheck membership
            is required to submit a review.
          </p>

          <div className="actions">
            <Link
              href="/membership"
              className="btn"
            >
              View Membership
            </Link>

            <Link
              href={`/leagues/${league.id}`}
              className="btn dark"
            >
              Back To League
            </Link>
          </div>
        </section>
      </main>
    );
  }

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
            href={`/leagues/${league.id}`}
          >
            Back To League
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          League Evaluation
        </div>

        <h1>
          Rate {league.name}.
        </h1>

        <p>
          Help another professional player
          understand what it&apos;s really like
          to play in this league.
        </p>
      </section>

      <section
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          padding: "20px 6% 90px",
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          <RatingField
            label="Overall"
            value={overall}
            onChange={setOverall}
          />

          <RatingField
            label="Communication"
            value={communication}
            onChange={setCommunication}
          />

          <RatingField
            label="Professionalism"
            value={professionalism}
            onChange={setProfessionalism}
          />

          <RatingField
            label="Player Development"
            value={development}
            onChange={setDevelopment}
          />

          <RatingField
            label="Payment Experience"
            value={payment}
            onChange={setPayment}
          />

          <div className="card">
            <div className="eyebrow">
              Your Experience
            </div>

            <label htmlFor="title">
              Review Title
            </label>

            <input
              id="title"
              className="input"
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value
                )
              }
              placeholder="Example: Great league, strong player support"
              maxLength={120}
            />

            <label htmlFor="body">
              Review
            </label>

            <textarea
              id="body"
              value={body}
              onChange={(event) =>
                setBody(
                  event.target.value
                )
              }
              placeholder="Share your experience with this league..."
              minLength={20}
              maxLength={5000}
              required
            />

            <p className="muted">
              {body.length}/5000 characters
            </p>
          </div>

          {message && (
            <div className="card">
              <p
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            </div>
          )}

          <button
            type="submit"
            className="btn"
            disabled={submitting}
          >
            {submitting
              ? "Submitting..."
              : "Submit Review"}
          </button>
        </form>
      </section>
    </main>
  );
}
