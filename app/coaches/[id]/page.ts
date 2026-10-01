"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
  body: string | null;
  created_at: string;
};

function average(
  reviews: Review[],
  field: keyof Review
) {
  const values = reviews
    .map((review) => review[field])
    .filter(
      (value): value is number =>
        typeof value === "number"
    );

  if (values.length === 0) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  ).toFixed(1);
}

export default function CoachProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [coach, setCoach] = useState<Coach | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCoach() {
      const { data: coachData } = await supabase
        .from("coaches")
        .select("id, name, country, city")
        .eq("id", id)
        .single();

      const { data: reviewData } = await supabase
        .from("reviews")
        .select(
          "id, overall_rating, communication_rating, professionalism_rating, development_rating, payment_rating, title, body, created_at"
        )
        .eq("coach_id", id)
        .eq("status", "approved")
        .order("created_at", {
          ascending: false,
        });

      setCoach(coachData);
      setReviews(reviewData || []);
      setLoading(false);
    }

    if (id) {
      loadCoach();
    }
  }, [id]);

  if (loading) {
    return (
      <main>
        <section className="hero">
          <h1>Loading coach...</h1>
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

  const overall = average(
    reviews,
    "overall_rating"
  );

  const communication = average(
    reviews,
    "communication_rating"
  );

  const professionalism = average(
    reviews,
    "professionalism_rating"
  );

  const development = average(
    reviews,
    "development_rating"
  );

  const payment = average(
    reviews,
    "payment_rating"
  );

  return (
    <main>
      <nav className="nav">
        <Link href="/" className="logo">
          Hoop<span>Check</span>
        </Link>

        <div className="links">
          <Link href="/coaches">Coaches</Link>
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          Coach Profile
        </div>

        <h1>{coach.name}</h1>

        <p>
          {coach.city && coach.country
            ? `${coach.city}, ${coach.country}`
            : coach.country ||
              coach.city ||
              "Location not listed"}
        </p>

        <p className="muted">
          {reviews.length}{" "}
          {reviews.length === 1
            ? "player review"
            : "player reviews"}
        </p>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Overall</h2>
          <p>
            {overall
              ? `⭐ ${overall} / 5`
              : "Not rated yet"}
          </p>
        </div>

        <div className="card">
          <h2>Communication</h2>
          <p>
            {communication
              ? `⭐ ${communication} / 5`
              : "Not rated yet"}
          </p>
        </div>

        <div className="card">
          <h2>Professionalism</h2>
          <p>
            {professionalism
              ? `⭐ ${professionalism} / 5`
              : "Not rated yet"}
          </p>
        </div>

        <div className="card">
          <h2>Player Development</h2>
          <p>
            {development
              ? `⭐ ${development} / 5`
              : "Not rated yet"}
          </p>
        </div>

        <div className="card">
          <h2>Payment</h2>
          <p>
            {payment
              ? `⭐ ${payment} / 5`
              : "Not rated yet"}
          </p>
        </div>
      </section>

      <section className="hero">
        <h2>Player Reviews</h2>

        {reviews.length === 0 ? (
          <div className="card">
            <p>
              No approved reviews have been submitted
              for this coach yet.
            </p>

            <Link
  href={`/coaches/${coach.id}/review`}
  className="btn"
>
  Write a Review
</Link>
          </div>
        ) : (
          <div className="grid">
            {reviews.map((review) => (
              <div
                className="card"
                key={review.id}
              >
                <h2>
                  ⭐ {review.overall_rating} / 5
                </h2>

                {review.title && (
                  <h3>{review.title}</h3>
                )}

                {review.body && (
                  <p>{review.body}</p>
                )}

                <p className="muted">
                  {new Date(
                    review.created_at
                  ).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
