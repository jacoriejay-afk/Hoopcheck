"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

type League = {
  id: string;
  name: string;
  country: string | null;
  level: string | null;
};

export default function LeagueReviewPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [league, setLeague] = useState<League | null>(null);
  const [hasAccess, setHasAccess] = useState(false);

  const [overallRating, setOverallRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [professionalismRating, setProfessionalismRating] =
    useState(0);
  const [developmentRating, setDevelopmentRating] = useState(0);
  const [paymentRating, setPaymentRating] = useState(0);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

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

      const { data: leagueData, error: leagueError } =
        await supabase
          .from("leagues")
          .select("id, name, country, level")
          .eq("id", id)
          .single();

      if (leagueError) {
        console.error("Error loading league:", leagueError);
        setLeague(null);
        setLoading(false);
        return;
      }

      setLeague(leagueData);

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();

      const activeSubscription =
        subscription &&
        (subscription.status === "active" ||
          subscription.status === "trialing") &&
        (!subscription.current_period_end ||
          new Date(subscription.current_period_end) > new Date());

      const { data: adminRole } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const isAdmin =
        adminRole?.role === "admin" ||
        adminRole?.role === "moderator";

      setHasAccess(!!activeSubscription || !!isAdmin);
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

    if (
      overallRating === 0 ||
      communicationRating === 0 ||
      professionalismRating === 0 ||
      developmentRating === 0 ||
      paymentRating === 0
    ) {
      setMessage("Please give a rating in every category.");
      return;
    }

    if (!body.trim()) {
      setMessage("Please write about your experience.");
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("reviews")
      .insert({
        author_id: user.id,
        coach_id: null,
        team_id: null,
        league_id: id,
        overall_rating: overallRating,
        communication_rating: communicationRating,
        professionalism_rating: professionalismRating,
        development_rating: developmentRating,
        payment_rating: paymentRating,
        title: title.trim() || null,
        body: body.trim(),
        status: "pending",
      });

    if (error) {
      console.error("Error submitting review:", error);

      setMessage(
        `Could not submit review: ${error.message}`
      );

      setSubmitting(false);
      return;
    }

    setMessage(
      "Your review has been submitted and is waiting for moderation."
    );

    setSubmitting(false);

    setTimeout(() => {
      router.push(`/leagues/${id}`);
    }, 1500);
  }

  function RatingButtons({
    value,
    onChange,
  }: {
    value: number;
    onChange: (value: number) => void;
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
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
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
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <main>
        <section className="hero">
          <h1>Loading...</h1>
        </section>
      </main>
    );
  }

  if (!league) {
    return (
      <main>
        <section className="hero">
          <h1>League not found</h1>

          <Link href="/leagues" className="btn">
            Back to Leagues
          </Link>
        </section>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main>
        <nav className="nav">
          <Link href="/" className="logo">
            Hoop<span>Check</span>
          </Link>

          <div className="links">
            <Link href={`/leagues/${league.id}`}>
              Back to League
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

          <h1>Unlock Review Access</h1>

          <p>
            An active HoopCheck membership is required
            to submit player reviews.
          </p>

          <div className="actions">
            <Link href="/membership" className="btn">
              View Memberships
            </Link>

            <Link
              href={`/leagues/${league.id}`}
              className="btn dark"
            >
              Back to League
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <nav className="nav">
        <Link href="/" className="logo">
          Hoop<span>Check</span>
        </Link>

        <div className="links">
          <Link href={`/leagues/${league.id}`}>
            Back to League
          </Link>

          <Link href="/dashboard">
            Dashboard
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          Write a Player Review
        </div>

        <h1>{league.name}</h1>

        <p>
          Share your experience with this league to help
          other professional players make informed
          decisions.
        </p>

        <p className="muted">
          {league.country || "Country not listed"}
        </p>

        {league.level && (
          <p className="muted">
            Level: {league.level}
          </p>
        )}
      </section>

      <section className="form">
        <form onSubmit={handleSubmit}>
          <h2>Rate Your Experience</h2>

          <label>Overall Rating</label>

          <RatingButtons
            value={overallRating}
            onChange={setOverallRating}
          />

          <label>Communication</label>

          <RatingButtons
            value={communicationRating}
            onChange={setCommunicationRating}
          />

          <label>Professionalism</label>

          <RatingButtons
            value={professionalismRating}
            onChange={setProfessionalismRating}
          />

          <label>Player Development</label>

          <RatingButtons
            value={developmentRating}
            onChange={setDevelopmentRating}
          />

          <label>Payment</label>

          <RatingButtons
            value={paymentRating}
            onChange={setPaymentRating}
          />

          <label>Review Title</label>

          <input
            className="input"
            type="text"
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="Example: Good league overall"
            maxLength={120}
          />

          <label>Your Experience</label>

          <textarea
            className="input"
            value={body}
            onChange={(event) =>
              setBody(event.target.value)
            }
            placeholder="Describe your experience with this league..."
            rows={8}
            maxLength={5000}
            required
          />

          <p className="muted">
            Your review will be submitted for moderation
            before it becomes publicly visible.
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
