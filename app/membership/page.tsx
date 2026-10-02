"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Subscription = {
  plan: "pro" | "premium";
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

function MembershipContent() {
  const searchParams =
    useSearchParams();

  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [checkoutLoading, setCheckoutLoading] =
    useState<"pro" | "premium" | null>(null);

  const [portalLoading, setPortalLoading] =
    useState(false);

  const success =
    searchParams.get("success") === "true";

  const canceled =
    searchParams.get("canceled") === "true";

  useEffect(() => {
    async function loadMembership() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } =
        await supabase
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
    (
      subscription.status === "active" ||
      subscription.status === "trialing"
    );

  async function startCheckout(
    plan: "pro" | "premium"
  ) {
    try {
      setCheckoutLoading(plan);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const response =
        await fetch(
          "/api/stripe/create-checkout",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              plan,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Unable to start checkout."
        );

        setCheckoutLoading(null);
        return;
      }

      if (!data.url) {
        alert(
          "Stripe did not return a checkout URL."
        );

        setCheckoutLoading(null);
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.error(
        "Checkout error:",
        error
      );

      alert(
        "Something went wrong starting checkout."
      );

      setCheckoutLoading(null);
    }
  }

  async function openCustomerPortal() {
    try {
      setPortalLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const response =
        await fetch(
          "/api/stripe/create-portal",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Unable to open subscription management."
        );

        setPortalLoading(false);
        return;
      }

      if (!data.url) {
        alert(
          "Stripe did not return a billing portal URL."
        );

        setPortalLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.error(
        "Portal error:",
        error
      );

      alert(
        "Something went wrong opening subscription management."
      );

      setPortalLoading(false);
    }
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

        <h1>
          Know before you sign.
        </h1>

        <p>
          Research coaches, professional
          teams, and leagues before your
          next overseas basketball
          opportunity. Read detailed
          ratings and reviews from the
          HoopCheck community.
        </p>

        {success && (
          <div className="card">
            <div className="eyebrow">
              PAYMENT RECEIVED
            </div>

            <h2>
              Welcome to HoopCheck.
            </h2>

            <p className="muted">
              Your subscription checkout
              was completed successfully.
              Your membership will update
              after Stripe confirms the
              subscription through the
              webhook.
            </p>
          </div>
        )}

        {canceled && (
          <div className="card">
            <div className="eyebrow">
              CHECKOUT CANCELED
            </div>

            <h2>
              No changes were made.
            </h2>

            <p className="muted">
              Your Stripe checkout was
              canceled. You can choose a
              membership whenever you're
              ready.
            </p>
          </div>
        )}

        {loading ? (
          <p className="muted">
            Checking your membership...
          </p>
        ) : activeSubscription ? (
          <div className="card">
            <div className="eyebrow">
              ACTIVE MEMBERSHIP
            </div>

            <h2>
              HoopCheck{" "}
              {subscription?.plan ===
              "premium"
                ? "Premium"
                : "Pro"}
            </h2>

            <p className="muted">
              Status:{" "}
              {subscription?.status}
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
                Your subscription is
                scheduled to cancel at
                the end of the current
                billing period.
              </p>
            )}

            <div className="actions">
              <button
                className="btn"
                onClick={
                  openCustomerPortal
                }
                disabled={
                  portalLoading
                }
              >
                {portalLoading
                  ? "Opening..."
                  : "Manage Subscription"}
              </button>

              <Link
                href="/dashboard"
                className="btn dark"
              >
                Dashboard
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      {!activeSubscription && (
        <section className="grid">
          <div className="card">
            <div className="eyebrow">
              HOOPCHECK PRO
            </div>

            <h2>
              $7.99/month
            </h2>

            <p>
              Essential access for
              players researching
              overseas opportunities.
            </p>

            <ul className="muted">
              <li>
                Full coach ratings
                and reviews
              </li>
              <li>
                Full team ratings
                and reviews
              </li>
              <li>
                Full league ratings
                and reviews
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
              disabled={
                checkoutLoading !== null
              }
              onClick={() =>
                startCheckout("pro")
              }
            >
              {checkoutLoading ===
              "pro"
                ? "Loading..."
                : "Choose Pro"}
            </button>
          </div>

          <div className="card">
            <div className="eyebrow">
              HOOPCHECK PREMIUM
            </div>

            <h2>
              $15.99/month
            </h2>

            <p>
              Advanced access for
              players who want the
              complete HoopCheck
              research experience.
            </p>

            <ul className="muted">
              <li>
                Everything in Pro
              </li>
              <li>
                Advanced research
                tools
              </li>
              <li>
                Expanded coach,
                team, and league
                insights
              </li>
              <li>
                Premium discovery
                features
              </li>
              <li>
                Priority access to
                new features
              </li>
            </ul>

            <button
              className="btn"
              disabled={
                checkoutLoading !== null
              }
              onClick={() =>
                startCheckout(
                  "premium"
                )
              }
            >
              {checkoutLoading ===
              "premium"
                ? "Loading..."
                : "Choose Premium"}
            </button>
          </div>
        </section>
      )}

      <section className="hero">
        <div className="card">
          <h2>
            Your membership powers
            HoopCheck
          </h2>

          <p className="muted">
            Stripe securely handles
            your subscription and
            billing. You can manage
            your payment method,
            cancel, or update your
            subscription through
            Stripe.
          </p>
        </div>
      </section>
    </main>
  );
}

export default function MembershipPage() {
  return (
    <Suspense
      fallback={
        <main>
          <section className="hero">
            <h1>
              Loading membership...
            </h1>
          </section>
        </main>
      }
    >
      <MembershipContent />
    </Suspense>
  );
}
