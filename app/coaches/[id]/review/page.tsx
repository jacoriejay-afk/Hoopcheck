"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

  const [coach, setCoach] = useState<Coach | null>(null);

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
    async function loadCoach() {
      const { data, error } = await supabase
        .from("coaches")
        .select("id, name, country, city")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error loading coach:", error);
      }

      setCoach(data || null);
      setLoading(false);
    }

    if (id) {
      loadCoach();
    }
  }, [id]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

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
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("reviews")
      .insert({
        author_id: user.id,
        coach_id: id,
        team_id: null,
        league_id: null,
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
      router.push(`/coaches/${id}`);
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

  if (!coach) {
    return (
      <main>
        <section className="hero">
          <h1>Coach not found</h1>

          <Link href="/coaches" className="btn">
            Back to Coaches
          </Link>
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
          <Link href={`/coaches/${coach.id}`}>
            Back to Coach
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

        <h1>{coach.name}</h1>

        <p>
          Share your experience with this coach to help
          other professional players make informed
          decisions.
        </p>
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
            placeholder="Example: Great coach, difficult communication"
            maxLength={120}
          />

          <label>Your Experience</label>

          <textarea
            className="input"
            value={body}
            onChange={(event) =>
              setBody(event.target.value)
            }
            placeholder="Describe your experience working with this coach..."
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
