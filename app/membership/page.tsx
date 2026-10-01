"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Subscription = {
  plan: "pro" | "premium";
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export default function MembershipPage() {
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMembership() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "plan, status, current_period_end, cancel_at_period_end"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error(
          "Error loading subscription:",
          error
        );
      }

      setSubscription(data || null);
      setLoading(false);
    }

    loadMembership();
  }, []);

  const activeSubscription =
    subscription &&
    (subscription.status === "active" ||
      subscription.status === "trialing");

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
          HoopCheck Membership
        </div>

        <h1>Know before you sign.</h1>

        <p>
          Unlock deeper player experiences and research
          coaches, teams, and leagues before your next
          overseas basketball opportunity.
        </p>

        {loading ? (
          <p className="muted">
            Checking your membership...
          </p>
        ) : activeSubscription ? (
          <div className="card">
            <h2>
              You're subscribed to HoopCheck{" "}
              {subscription?.plan === "premium"
                ? "Premium"
                : "Pro"}
            </h2>

            <p className="muted">
              Status: {subscription?.status}
            </p>

            {subscription?.current_period_end && (
              <p className="muted">
                Current period ends:{" "}
                {new Date(
                  subscription.current_period_end
                ).toLocaleDateString()}
              </p>
            )}

            {subscription?.cancel_at_period_end && (
              <p className="muted">
                Your subscription is scheduled to
                cancel at the end of the current
                billing period.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <section className="grid">
        <div className="card">
          <div className="eyebrow">
            HOOPCHECK PRO
          </div>

          <h2>$7.99/month</h2>

          <p>
            Essential access for players researching
            overseas opportunities.
          </p>

          <ul className="muted">
            <li>
              Full player ratings
            </li>

            <li>
              Full player reviews
            </li>

            <li>
              Coach research
            </li>

            <li>
              Team research
            </li>

            <li>
              League research
            </li>
          </ul>

          <button
            className="btn"
            disabled={activeSubscription}
          >
            {activeSubscription
              ? "Current Membership"
              : "Choose Pro"}
          </button>
        </div>

        <div className="card">
          <div className="eyebrow">
            HOOPCHECK PREMIUM
          </div>

          <h2>$15.99/month</h2>

          <p>
            Advanced access for players who want the
            complete HoopCheck experience.
          </p>

          <ul className="muted">
            <li>
              Everything in Pro
            </li>

            <li>
              Advanced research tools
            </li>

            <li>
              Expanded player insights
            </li>

            <li>
              Premium discovery features
            </li>

            <li>
              Priority access to new features
            </li>
          </ul>

          <button
            className="btn"
            disabled={activeSubscription}
          >
            {activeSubscription
              ? "Current Membership"
              : "Choose Premium"}
          </button>
        </div>
      </section>

      <section className="hero">
        <div className="card">
          <h2>Already subscribed?</h2>

          <p className="muted">
            Your membership will automatically sync
            with HoopCheck after payment is completed.
          </p>

          <Link
            href="/dashboard"
            className="btn dark"
          >
            Back to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
