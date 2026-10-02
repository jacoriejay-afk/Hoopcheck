"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

type Coach = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
};

export default function CoachReviewPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [coach, setCoach] =
    useState<Coach | null>(null);

  const [hasAccess, setHasAccess] =
    useState(false);

  const [alreadyReviewed, setAlreadyReviewed] =
    useState(false);

  const [overallRating, setOverallRating] =
    useState(0);

  const [
    communicationRating,
    setCommunicationRating,
  ] = useState(0);

  const [
    professionalismRating,
    setProfessionalismRating,
  ] = useState(0);

  const [
    developmentRating,
    setDevelopmentRating,
  ] = useState(0);

  const [
    paymentRating,
    setPaymentRating,
  ] = useState(0);

  const [title, setTitle] =
    useState("");

  const [body, setBody] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    async function loadPage() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
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
        .single();

      if (coachError) {
        console.error(
          "Error loading coach:",
          coachError
        );

        setCoach(null);
        setLoading(false);
        return;
      }

      setCoach(coachData);

      const {
        data: subscription,
      } = await supabase
        .from("subscriptions")
        .select(
          "status, current_period_end"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      const activeSubscription =
        subscription &&
        (
          subscription.status ===
            "active" ||
          subscription.status ===
            "trialing"
        ) &&
        (
          !subscription.current_period_end ||
          new Date(
            subscription.current_period_end
          ) > new Date()
        );

      const {
        data: adminRole,
      } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const isAdmin =
        adminRole?.role === "admin" ||
        adminRole?.role === "moderator";

      setHasAccess(
        !!activeSubscription ||
          !!isAdmin
      );

      const {
        data: existingReview,
        error: existingReviewError,
      } = await supabase
        .from("reviews")
        .select("id")
        .eq("author_id", user.id)
        .eq("coach_id", id)
        .maybeSingle();

      if (
        existingReviewError &&
        existingReviewError.code !==
          "PGRST116"
      ) {
        console.error(
          "Error checking existing review:",
          existingReviewError
        );
      }

      setAlreadyReviewed(
        !!existingReview
      );

      setLoading(false);
    }

    if (id) {
      loadPage();
    }
  }, [id, router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    if (!hasAccess) {
      setMessage(
        "An active HoopCheck membership is required to submit a review."
      );
      return;
    }

    if (alreadyReviewed) {
      setMessage(
        "You have already submitted a review for this coach."
      );
      return;
    }

    if (
      overallRating === 0 ||
      communicationRating === 0 ||
      professionalismRating === 0 ||
      developmentRating === 0 ||
      paymentRating === 0
    ) {
      setMessage(
        "Please give a rating in every category."
      );
      return;
    }

    const trimmedBody =
      body.trim();

    const trimmedTitle =
      title.trim();

    if (
      trimmedBody.length < 20
    ) {
      setMessage(
        "Your review must be at least 20 characters."
      );
      return;
    }

    if (
      trimmedBody.length > 5000
    ) {
      setMessage(
        "Your review must be 5,000 characters or fewer."
      );
      return;
    }

    if (
      trimmedTitle &&
      (
        trimmedTitle.length < 3 ||
        trimmedTitle.length > 120
      )
    ) {
      setMessage(
        "Your review title must be between 3 and 120 characters."
      );
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitting(false);
      router.replace("/login");
      return;
    }

    const { error } =
      await supabase
        .from("reviews")
        .insert({
          author_id: user.id,
          coach_id: id,
          team_id: null,
          league_id: null,
          overall_rating:
            overallRating,
          communication_rating:
            communicationRating,
          professionalism_rating:
            professionalismRating,
          development_rating:
            developmentRating,
          payment_rating:
            paymentRating,
          title:
            trimmedTitle || null,
          body: trimmedBody,
          status: "pending",
        });

    if (error) {
      console.error(
        "Error submitting review:",
        error
      );

      if (
        error.code === "23505"
      ) {
        setMessage(
          "You have already submitted a review for this coach."
        );
        setAlreadyReviewed(true);
      } else {
        setMessage(
          `Could not submit review: ${error.message}`
        );
      }

      setSubmitting(false);
      return;
    }

    setMessage(
      "Your review has been submitted and is waiting for moderation."
    );

    setSubmitting(false);

    setTimeout(() => {
      router.push(
        `/coaches/${id}`
      );
    }, 1500);
  }

  function RatingButtons({
    value,
    onChange,
  }: {
    value: number;
    onChange: (
      value: number
    ) => void;
  }) {
    return (
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        {[1, 2, 3, 4, 5].map(
          (rating) => (
            <button
              key={rating}
              type="button"
              onClick={() =>
                onChange(rating)
              }
              aria-label={`Rate ${rating} out of 5`}
              aria-pressed={
                value === rating
              }
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                border:
                  value === rating
                    ? "2px solid #ff8a00"
                    : "1px solid #303746",
                background:
                  value === rating
                    ? "#ff8a00"
                    : "#080b12",
                color:
                  value === rating
                    ? "#111111"
                    : "#ffffff",
                fontWeight: 800,
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              {rating}
            </button>
          )
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <main>
        <section className="hero">
          <h1>
            Loading...
          </h1>
        </section>
      </main>
    );
  }

  if (!coach) {
    return (
      <main>
        <section className="hero">
          <h1>
            Coach not found
          </h1>

          <Link
            href="/coaches"
            className="btn"
          >
            Back to Coaches
          </Link>
        </section>
      </main>
    );
  }

  if (!hasAccess) {
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
              href={`/coaches/${coach.id}`}
            >
              Back to Coach
            </Link>

            <Link href="/dashboard">
              Dashboard
            </Link>
          </div>
        </nav>

        <section className="hero">
          <div className="eyebrow">
            MEMBERSHIP REQUIRED
          </div>

          <h1>
            Unlock Review Access
          </h1>

          <p>
            An active HoopCheck
            membership is required
            to submit player reviews.
          </p>

          <div className="actions">
            <Link
              href="/membership"
              className="btn"
            >
              View Memberships
            </Link>

            <Link
              href={`/coaches/${coach.id}`}
              className="btn dark"
            >
              Back to Coach
            </Link>
          </div>
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

          <div className="links">
            <Link
              href={`/coaches/${coach.id}`}
            >
              Back to Coach
            </Link>

            <Link href="/dashboard">
              Dashboard
            </Link>
          </div>
        </nav>

        <section className="hero">
          <div className="eyebrow">
            REVIEW ALREADY SUBMITTED
          </div>

          <h1>
            You already reviewed {coach.name}.
          </h1>

          <p>
            Each player can submit one
            review per coach.
          </p>

          <div className="actions">
            <Link
              href={`/coaches/${coach.id}`}
              className="btn"
            >
              Back to Coach
            </Link>

            <Link
              href="/dashboard"
              className="btn dark"
            >
              Dashboard
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
            href={`/coaches/${coach.id}`}
          >
            Back to Coach
          </Link>

          <Link href="/dashboard">
            Dashboard
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          WRITE A PLAYER REVIEW
        </div>

        <h1>
          {coach.name}
        </h1>

        <p>
          Share your experience with
          this coach to help other
          professional players make
          informed decisions.
        </p>
      </section>

      <section className="form">
        <form
          onSubmit={handleSubmit}
        >
          <h2>
            Rate Your Experience
          </h2>

          <label>
            Overall Rating
          </label>

          <RatingButtons
            value={
              overallRating
            }
            onChange={
              setOverallRating
            }
          />

          <label>
            Communication
          </label>

          <RatingButtons
            value={
              communicationRating
            }
            onChange={
              setCommunicationRating
            }
          />

          <label>
            Professionalism
          </label>

          <RatingButtons
            value={
              professionalismRating
            }
            onChange={
              setProfessionalismRating
            }
          />

          <label>
            Player Development
          </label>

          <RatingButtons
            value={
              developmentRating
            }
            onChange={
              setDevelopmentRating
            }
          />

          <label>
            Payment
          </label>

          <RatingButtons
            value={
              paymentRating
            }
            onChange={
              setPaymentRating
            }
          />

          <label>
            Review Title
          </label>

          <input
            className="input"
            type="text"
            value={title}
            onChange={(event) =>
              setTitle(
                event.target.value
              )
            }
            placeholder="Example: Great coach, difficult communication"
            maxLength={120}
          />

          <label>
            Your Experience
          </label>

          <textarea
            className="input"
            value={body}
            onChange={(event) =>
              setBody(
                event.target.value
              )
            }
            placeholder="Describe your experience working with this coach..."
            rows={8}
            maxLength={5000}
            required
          />

          <p className="muted">
            Your review will be
            submitted for moderation
            before it becomes publicly
            visible.
          </p>

          {message && (
            <div className="card">
              <p>{message}</p>
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
