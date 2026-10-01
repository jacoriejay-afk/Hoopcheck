"use client";

import { useEffect, useState } from "react";
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
  communication_rating: number;
  professionalism_rating: number;
  development_rating: number;
  payment_rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
};

export default function CoachPage() {
  const params = useParams();
  const id = params.id as string;

  const [coach, setCoach] = useState<Coach | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCoach() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: coachData, error: coachError } =
        await supabase
          .from("coaches")
          .select("*")
          .eq("id", id)
          .single();

      if (coachError) {
        console.error(
          "Error loading coach:",
          coachError
        );

        setLoading(false);
        return;
      }

      setCoach(coachData);

      let hasAccess = false;

      if (user) {
        const { data: subscription } =
          await supabase
            .from("subscriptions")
            .select(
              "status, current_period_end"
            )
            .eq("user_id", user.id)
            .maybeSingle();

        const active =
          subscription &&
          (subscription.status === "active" ||
            subscription.status === "trialing") &&
          (!subscription.current_period_end ||
            new Date(
              subscription.current_period_end
            ) > new Date());

        const { data: adminRole } =
          await supabase
            .from("admin_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

        const admin =
          adminRole?.role === "admin" ||
          adminRole?.role === "moderator";

        hasAccess = !!active || admin;

        setIsSubscriber(!!active);
        setIsAdmin(!!admin);
      }

      if (hasAccess) {
        const { data: reviewData, error: reviewError } =
          await supabase
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
            .eq("coach_id", id)
            .eq("status", "approved")
            .order("created_at", {
              ascending: false,
            });

        if (reviewError) {
          console.error(
            "Error loading reviews:",
            reviewError
          );
        } else {
          setReviews(reviewData || []);
        }
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
          <p>Loading coach...</p>
        </section>
      </main>
    );
  }

  if (!coach) {
    return (
      <main>
        <section className="hero">
          <h1>Coach not found</h1>
          <Link href="/coaches">
            Back to coaches
          </Link>
        </section>
      </main>
    );
  }

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce(
            (sum, review) =>
              sum + Number(review.overall_rating),
            0
          ) / reviews.length
        ).toFixed(1)
      : null;

  return (
    <main>
      <nav className="nav">
        <Link href="/" className="logo">
          Hoop<span>Check</span>
        </Link>

        <div className="links">
          <Link href="/dashboard">
            Dashboard
          </Link>

          <Link href="/coaches">
            Coaches
          </Link>

          <Link href="/teams">
            Teams
          </Link>

          <Link href="/leagues">
            Leagues
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          COACH
        </div>

        <h1>{coach.name}</h1>

        <p>
          {coach.city || "Location unavailable"}
          {coach.country
            ? `, ${coach.country}`
            : ""}
        </p>

        {isSubscriber || isAdmin ? (
          <>
            <div className="card">
              <h2>
                {averageRating
                  ? `${averageRating}/5`
                  : "No ratings yet"}
              </h2>

              <p className="muted">
                {reviews.length} approved review
                {reviews.length === 1
                  ? ""
                  : "s"}
              </p>
            </div>

            <div className="actions">
              <Link
                href={`/coaches/${id}/review`}
                className="btn"
              >
                Write a Review
              </Link>

              <Link
                href="/coaches"
                className="btn dark"
              >
                Back to Coaches
              </Link>
            </div>
          </>
        ) : (
          <div className="card">
            <div className="eyebrow">
              MEMBER ACCESS
            </div>

            <h2>
              Unlock coach reviews
            </h2>

            <p className="muted">
              Create an account and subscribe
              to view full ratings and reviews
              from other professional players.
            </p>

            <div className="actions">
              <Link
                href="/membership"
                className="btn"
              >
                Unlock Full Access
              </Link>

              <Link
                href="/login"
                className="btn dark"
              >
                Log In
              </Link>
            </div>
          </div>
        )}
      </section>

      {(isSubscriber || isAdmin) && (
        <section className="grid">
          {reviews.length === 0 ? (
            <div className="card">
              <h2>
                No approved reviews yet
              </h2>

              <p className="muted">
                Be the first player to share
                your experience with this coach.
              </p>
            </div>
          ) : (
            reviews.map((review) => (
              <div
                className="card"
                key={review.id}
              >
                <div className="eyebrow">
                  {review.overall_rating}/5
                </div>

                {review.title && (
                  <h2>{review.title}</h2>
                )}

                {review.body && (
                  <p>{review.body}</p>
                )}

                <div className="muted">
                  <p>
                    Communication:{" "}
                    {review.communication_rating}/5
                  </p>

                  <p>
                    Professionalism:{" "}
                    {review.professionalism_rating}/5
                  </p>

                  <p>
                    Development:{" "}
                    {review.development_rating}/5
                  </p>

                  <p>
                    Payment:{" "}
                    {review.payment_rating}/5
                  </p>
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </main>
  );
}
