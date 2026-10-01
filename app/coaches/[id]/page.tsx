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
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    async function loadCoach() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setLoggedIn(!!user);

      if (user) {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("status, current_period_end")
          .eq("user_id", user.id)
          .maybeSingle();

        const active =
          subscription &&
          (subscription.status === "active" ||
            subscription.status === "trialing") &&
          (!subscription.current_period_end ||
            new Date(subscription.current_period_end) >
              new Date());

        setIsSubscriber(!!active);

        const { data: adminRole } = await supabase
          .from("admin_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        setIsAdmin(
          adminRole?.role === "admin" ||
            adminRole?.role === "moderator"
        );
      }

      const { data: coachData } = await supabase
        .from("coaches")
        .select("id, name, country, city")
        .eq("id", id)
        .single();

      setCoach(coachData);

      if (user && (isSubscriber || isAdmin)) {
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

        setReviews(reviewData || []);
      }

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

  const hasFullAccess =
    isSubscriber || isAdmin;

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
          <Link href="/coaches">
            Coaches
          </Link>

          <Link href="/dashboard">
            Dashboard
          </Link>
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
          Research this coach before your next
          overseas opportunity.
        </p>
      </section>

      {!hasFullAccess ? (
        <section className="hero">
          <div className="card">
            <div className="eyebrow">
              🔒 MEMBER ACCESS
            </div>

            <h2>
              Full ratings & reviews are locked
            </h2>

            <p className="muted">
              HoopCheck members get access to
              player ratings, detailed reviews,
              and deeper research on coaches,
              teams, and leagues.
            </p>

            <div className="actions">
              <Link
                href="/membership"
                className="btn"
              >
                Unlock Full Access
              </Link>

              {!loggedIn && (
                <Link
                  href="/login"
                  className="btn dark"
                >
                  Log In
                </Link>
              )}
            </div>
          </div>
        </section>
      ) : (
        <>
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
                  No approved reviews have been
                  submitted for this coach yet.
                </p>

                <Link
                  href={`/coaches/${coach.id}/review`}
                  className="btn"
                >
                  Write a Review
                </Link>
              </div>
            ) : (
              <>
                <div className="grid">
                  {reviews.map((review) => (
                    <div
                      className="card"
                      key={review.id}
                    >
                      <h2>
                        ⭐{" "}
                        {review.overall_rating} / 5
                      </h2>

                      {review.title && (
                        <h3>
                          {review.title}
                        </h3>
                      )}

                      {review.body && (
                        <p>
                          {review.body}
                        </p>
                      )}

                      <p className="muted">
                        {new Date(
                          review.created_at
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: "24px",
                  }}
                >
                  <Link
                    href={`/coaches/${coach.id}/review`}
                    className="btn"
                  >
                    Write a Review
                  </Link>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
