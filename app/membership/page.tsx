"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  useSearchParams,
} from "next/navigation";

import { supabase } from "../../lib/supabase";

type Subscription = {
  plan: "pro" | "premium" | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

function MembershipContent() {
  const searchParams =
    useSearchParams();

  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [checkoutLoading, setCheckoutLoading] =
    useState<string | null>(null);

  const [portalLoading, setPortalLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    async function loadMembership() {
      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const {
        data,
        error,
      } =
        await supabase
          .from("subscriptions")
          .select(
            "plan, status, current_period_end, cancel_at_period_end"
          )
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

      if (!error && data) {
        setSubscription(data);
      }

      setLoading(false);
    }

    loadMembership();
  }, []);

  useEffect(() => {
    if (
      searchParams.get("success") ===
      "true"
    ) {
      setMessage(
        "Checkout completed. Your membership will activate after Stripe confirms the subscription."
      );
    }

    if (
      searchParams.get("canceled") ===
      "true"
    ) {
      setMessage(
        "Checkout was canceled. No subscription was created."
      );
    }
  }, [searchParams]);

  async function startCheckout(
    plan: "pro" | "premium"
  ) {
    setMessage("");
    setCheckoutLoading(plan);

    const {
      data: {
        session,
      },
    } =
      await supabase.auth.getSession();

    if (!session?.access_token) {
      window.location.href =
        "/login";
      return;
    }

    try {
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
        setMessage(
          data.error ||
            "Unable to start checkout."
        );

        setCheckoutLoading(null);
        return;
      }

      if (data.url) {
        window.location.href =
          data.url;
        return;
      }

      setMessage(
        "Stripe did not return a checkout URL."
      );
    } catch (error) {
      console.error(
        "Checkout error:",
        error
      );

      setMessage(
        "Something went wrong starting checkout."
      );
    }

    setCheckoutLoading(null);
  }

  async function openCustomerPortal() {
    setMessage("");
    setPortalLoading(true);

    const {
      data: {
        session,
      },
    } =
      await supabase.auth.getSession();

    if (!session?.access_token) {
      window.location.href =
        "/login";
      return;
    }

    try {
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
        setMessage(
          data.error ||
            "Unable to open your billing portal."
        );

        setPortalLoading(false);
        return;
      }

      if (data.url) {
        window.location.href =
          data.url;
        return;
      }

      setMessage(
        "Stripe did not return a portal URL."
      );
    } catch (error) {
      console.error(
        "Portal error:",
        error
      );

      setMessage(
        "Something went wrong opening your billing portal."
      );
    }

    setPortalLoading(false);
  }

  const isActive =
    subscription?.status ===
      "active" ||
    subscription?.status ===
      "trialing";

  const planLabel =
    subscription?.plan ===
    "premium"
      ? "Premium"
      : subscription?.plan ===
        "pro"
      ? "Pro"
      : "Free";

  const periodEnd =
    subscription?.current_period_end
      ? new Date(
          subscription.current_period_end
        ).toLocaleDateString()
      : null;

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
          Know more.
          <br />
          Move smarter.
        </h1>

        <p>
          Unlock the player intelligence you
          need before signing your next
          overseas basketball contract.
        </p>

        {message && (
          <div
            className="card"
            style={{
              marginTop: "28px",
              maxWidth: "760px",
            }}
          >
            <p
              role="status"
              aria-live="polite"
              style={{
                margin: 0,
              }}
            >
              {message}
            </p>
          </div>
        )}
      </section>

      {isActive && (
        <section
          style={{
            maxWidth: "1180px",
            margin: "0 auto",
            padding: "0 6% 30px",
          }}
        >
          <div
            className="card"
            style={{
              borderColor:
                "rgba(255, 106, 0, 0.45)",
              background:
                "linear-gradient(145deg, #171717, #0c0c0c)",
            }}
          >
            <div className="eyebrow">
              Current Membership
            </div>

            <h2
              style={{
                fontSize: "34px",
                marginBottom: "8px",
              }}
            >
              HoopCheck {planLabel}
            </h2>

            <p>
              Your membership is currently{" "}
              <strong>
                {subscription?.status}
              </strong>
              .
            </p>

            {periodEnd && (
              <p className="muted">
                Current billing period ends:{" "}
                {periodEnd}
              </p>
            )}

            {subscription?.cancel_at_period_end && (
              <p
                style={{
                  color:
                    "var(--orange)",
                  fontWeight: 800,
                }}
              >
                Your membership is scheduled
                to cancel at the end of the
                current billing period.
              </p>
            )}

            <div className="actions">
              <button
                type="button"
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
                  : "Manage Billing"}
              </button>

              <Link
                href="/dashboard"
                className="btn dark"
              >
                Back To Dashboard
              </Link>
            </div>
          </div>
        </section>
      )}

      {!isActive && (
        <section
          className="grid"
          style={{
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            maxWidth: "1000px",
          }}
        >
          <div className="card">
            <div className="eyebrow">
              HoopCheck Pro
            </div>

            <h2
              style={{
                fontSize: "44px",
                marginBottom: "4px",
              }}
            >
              $7.99
              <span
                style={{
                  fontSize: "15px",
                  color:
                    "var(--gray-500)",
                  fontWeight: 700,
                }}
              >
                /month
              </span>
            </h2>

            <p>
              Everything you need to research
              your next basketball opportunity.
            </p>

            <div
              style={{
                display: "grid",
                gap: "11px",
                margin:
                  "24px 0",
              }}
            >
              {[
                "Full coach ratings and reviews",
                "Full team ratings and reviews",
                "Full league ratings and reviews",
                "Coach research",
                "Team research",
                "League research",
              ].map(
                (feature) => (
                  <div
                    key={feature}
                    style={{
                      display:
                        "flex",
                      gap: "10px",
                      alignItems:
                        "flex-start",
                      color:
                        "var(--gray-100)",
                      fontSize:
                        "14px",
                      lineHeight:
                        "1.5",
                    }}
                  >
                    <span
                      style={{
                        color:
                          "var(--orange)",
                        fontWeight:
                          900,
                      }}
                    >
                      ✓
                    </span>

                    <span>
                      {feature}
                    </span>
                  </div>
                )
              )}
            </div>

            <button
              type="button"
              className="btn"
              onClick={() =>
                startCheckout(
                  "pro"
                )
              }
              disabled={
                checkoutLoading !==
                null
              }
            >
              {checkoutLoading ===
              "pro"
                ? "Opening Stripe..."
                : "Choose Pro"}
            </button>
          </div>

          <div
            className="card"
            style={{
              borderColor:
                "var(--orange)",
              boxShadow:
                "0 18px 50px rgba(255, 106, 0, 0.12)",
            }}
          >
            <div className="eyebrow">
              HoopCheck Premium
            </div>

            <h2
              style={{
                fontSize: "44px",
                marginBottom: "4px",
              }}
            >
              $15.99
              <span
                style={{
                  fontSize: "15px",
                  color:
                    "var(--gray-500)",
                  fontWeight: 700,
                }}
              >
                /month
              </span>
            </h2>

            <p>
              Go deeper with expanded research
              and premium player intelligence.
            </p>

            <div
              style={{
                display: "grid",
                gap: "11px",
                margin:
                  "24px 0",
              }}
            >
              {[
                "Everything in Pro",
                "Advanced research tools",
                "Expanded coach insights",
                "Expanded team insights",
                "Expanded league insights",
                "Premium discovery features",
                "Priority access to new features",
              ].map(
                (feature) => (
                  <div
                    key={feature}
                    style={{
                      display:
                        "flex",
                      gap: "10px",
                      alignItems:
                        "flex-start",
                      color:
                        "var(--gray-100)",
                      fontSize:
                        "14px",
                      lineHeight:
                        "1.5",
                    }}
                  >
                    <span
                      style={{
                        color:
                          "var(--orange)",
                        fontWeight:
                          900,
                      }}
                    >
                      ✓
                    </span>

                    <span>
                      {feature}
                    </span>
                  </div>
                )
              )}
            </div>

            <button
              type="button"
              className="btn"
              onClick={() =>
                startCheckout(
                  "premium"
                )
              }
              disabled={
                checkoutLoading !==
                null
              }
            >
              {checkoutLoading ===
              "premium"
                ? "Opening Stripe..."
                : "Choose Premium"}
            </button>
          </div>
        </section>
      )}

      <section className="hero">
        <div className="eyebrow">
          Why HoopCheck
        </div>

        <h2>
          Your next contract
          <br />
          deserves research.
        </h2>

        <p>
          A contract tells you what you&apos;ll
          earn. HoopCheck helps you learn about
          the people and organizations behind it.
        </p>

        <div className="actions">
          <Link
            href="/coaches"
            className="btn"
          >
            Research Coaches
          </Link>

          <Link
            href="/teams"
            className="btn dark"
          >
            Research Teams
          </Link>

          <Link
            href="/leagues"
            className="btn dark"
          >
            Research Leagues
          </Link>
        </div>
      </section>

      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding:
            "0 6% 100px",
        }}
      >
        <div
          className="card"
          style={{
            textAlign: "center",
          }}
        >
          <div className="eyebrow">
            Simple Membership
          </div>

          <h2>
            Cancel through Stripe
            whenever you need.
          </h2>

          <p>
            HoopCheck uses Stripe for secure
            subscription billing. You can
            manage your payment method,
            subscription, and cancellation from
            the Stripe Customer Portal.
          </p>

          {!isActive && (
            <Link
              href="/signup"
              className="btn"
            >
              Create Your Account
            </Link>
          )}
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
