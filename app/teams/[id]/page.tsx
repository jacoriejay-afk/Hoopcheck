"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Team = {
  id: string;
  name: string;
  country: string | null;
  league_name: string | null;
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
): string | null {
  const values = reviews
    .map((review) => review[field])
    .filter(
      (value): value is number =>
        typeof value === "number"
    );

  if (values.length === 0) {
    return null;
  }

  const total = values.reduce(
    (sum, value) => sum + value,
    0
  );

  return (total / values.length).toFixed(1);
}

export default function TeamProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeam() {
      const { data: teamData, error: teamError } =
        await supabase
          .from("teams")
          .select(
            "id, name, country, league_name, city"
          )
          .eq("id", id)
          .single();

      if (teamError) {
        console.error(
          "Error loading team:",
          teamError
        );
      }

      const { data: reviewData, error: reviewError } =
        await supabase
          .from("reviews")
          .select(
            "id, overall_rating, communication_rating, professionalism_rating, development_rating, payment_rating, title, body, created_at"
          )
          .eq("team_id", id)
          .eq("status", "approved")
          .order("created_at", {
            ascending: false,
          });

      if (reviewError) {
        console.error(
          "Error loading team reviews:",
          reviewError
        );
      }

      setTeam(teamData || null);
      setReviews(reviewData || []);
      setLoading(false);
    }

    if (id) {
      loadTeam();
    }
  }, [id]);

  if (loading) {
    return (
      <main>
        <section className="hero">
          <h1>Loading team...</h1>
        </section>
      </main>
    );
  }

  if (!team) {
    return (
      <main>
        <nav className="nav">
          <Link href="/" className="logo">
            Hoop<span>Check</span>
          </Link>
        </nav>

        <section className="hero">
          <h1>Team not found</h1>

          <p className="muted">
            This team could not be found.
          </p>

          <Link
            href="/teams"
            className="btn"
          >
            Back to Teams
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
          <Link href="/teams">
            Teams
          </Link>

          <Link href="/dashboard">
            Dashboard
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          Team Profile
        </div>

        <h1>{team.name}</h1>

        <p>
          {team.city && team.country
            ? `${team.city}, ${team.country}`
            : team.country ||
              team.city ||
              "Location not listed"}
        </p>

        {team.league_name && (
          <p>
            League: {team.league_name}
          </p>
        )}

        <p className="muted">
          {reviews.length}{" "}
          {reviews.length === 1
            ? "player review"
            : "player reviews"}
        </p>

        <div className="actions">
          <Link
            href="/teams"
            className="btn dark"
          >
            ← Back to Teams
          </Link>

          <Link
            href={`/teams/${team.id}/review`}
            className="btn"
          >
            Write a Review
          </Link>
        </div>
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
            <h2>No reviews yet</h2>

            <p className="muted">
              No approved player reviews have been
              submitted for this team yet.
            </p>

            <Link
              href={`/teams/${team.id}/review`}
              className="btn"
            >
              Write the First Review
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

                <div className="muted">
                  <p>
                    Communication:{" "}
                    {review.communication_rating ??
                      "N/A"}
                    / 5
                  </p>

                  <p>
                    Professionalism:{" "}
                    {review.professionalism_rating ??
                      "N/A"}
                    / 5
                  </p>

                  <p>
                    Development:{" "}
                    {review.development_rating ??
                      "N/A"}
                    / 5
                  </p>

                  <p>
                    Payment:{" "}
                    {review.payment_rating ??
                      "N/A"}
                    / 5
                  </p>
                </div>

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
