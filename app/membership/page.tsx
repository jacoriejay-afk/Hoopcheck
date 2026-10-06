"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import HoopLoading from "../../components/HoopLoading";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Plan = "pro" | "premium";
type BillingInterval = "month" | "6_month" | "year";

type Subscription = {
  plan: Plan;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

function MembershipContent() {
  const searchParams = useSearchParams();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSubscription() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error loading subscription:", error);
      setError("We couldn't load your membership status.");
    } else {
      setSubscription(data as Subscription | null);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadSubscription();

    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      setMessage(
        "Checkout completed. Confirming your HoopCheck membership..."
      );

      let attempts = 0;
      const refresh = window.setInterval(async () => {
        attempts += 1;
        await loadSubscription();

        if (attempts >= 6) {
          window.clearInterval(refresh);
          setMessage(
            "Checkout completed. If your membership has not appeared yet, refresh this page in a moment while Stripe finishes confirming the subscription."
          );
        }
      }, 2000);

      return () => window.clearInterval(refresh);
    }

    if (canceled === "true") {
      setMessage("Checkout was canceled. No subscription was created.");
    }

    return undefined;
  }, [searchParams]);

  async function startCheckout(plan: Plan, interval: BillingInterval = billingInterval) {
    setCheckoutLoading(`${plan}-${interval}`);
    setError("");
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Please log in before purchasing a membership.");
        setCheckoutLoading(null);
        return;
      }

      const response = await fetch("/api/stripe/webhook/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan, interval }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to start checkout.");
      }

      if (!data?.url) {
        throw new Error("Stripe did not return a checkout URL.");
      }

      setCheckoutLoading(null);
      window.location.href = data.url;
    } catch (checkoutError) {
      console.error("Checkout error:", checkoutError);
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to start checkout."
      );
      setCheckoutLoading(null);
    }
  }

  async function cancelMembership() {
    if (!window.confirm("Cancel your HoopCheck membership at the end of your current billing period? You will keep full paid access until then.")) return;
    setCancelLoading(true); setError(""); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in before managing your membership.");
      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to cancel membership.");
      setSubscription((current) => current ? { ...current, cancel_at_period_end: true, current_period_end: data.current_period_end } : current);
      setMessage(`Membership canceled. Your paid access remains active until ${new Date(data.current_period_end).toLocaleDateString()}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to cancel membership."); }
    finally { setCancelLoading(false); }
  }

  async function resumeMembership() {
    setCancelLoading(true); setError(""); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in before managing your membership.");
      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to resume membership.");
      setSubscription((current) => current ? { ...current, cancel_at_period_end: false, current_period_end: data.current_period_end } : current);
      setMessage("Membership cancellation was removed. Your subscription will continue.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to resume membership."); }
    finally { setCancelLoading(false); }
  }

  async function openCustomerPortal() {
    setPortalLoading(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Please log in before managing your membership.");
        setPortalLoading(false);
        return;
      }

      const response = await fetch("/api/stripe/create-portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to open billing portal.");
      }

      if (!data?.url) {
        throw new Error("Stripe did not return a billing portal URL.");
      }

      setPortalLoading(false);
      window.location.href = data.url;
    } catch (portalError) {
      console.error("Portal error:", portalError);
      setError(
        portalError instanceof Error
          ? portalError.message
          : "Unable to open billing portal."
      );
      setPortalLoading(false);
    }
  }

  const isActive =
    subscription?.status === "active" || subscription?.status === "trialing";

  return (
    <main>
      <nav className="nav">
        <Link href="/" className="logo">
          Hoop<span>Check</span>
        </Link>
        <div className="links">
          <Link href="/search">Search</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/coaches" className="hide-mobile">
            Coaches
          </Link>
          <Link href="/teams" className="hide-mobile">
            Teams
          </Link>
          <Link href="/leagues" className="hide-mobile">
            Leagues
          </Link>
        </div>
      </nav>

      <section className="hero membership-hero">
        <div className="eyebrow">HoopCheck Membership</div>
        <h1>
          Research deeper.
          <br />
          Decide smarter.
        </h1>
        <p>
          Unlock full coach, team, and league ratings and reviews from the players
          who have already been there.
        </p>
        <div className="hero-links">
          <Link href="/search">Global Research Search →</Link>
        </div>
      </section>

      {message && <div className="status success">{message}</div>}
      {error && <div className="status error">{error}</div>}

      <section className="membership-section">
        {isActive && subscription ? (
          <div className="active-card">
            <div className="eyebrow">CURRENT MEMBERSHIP</div>
            <h2>
              HoopCheck {subscription.plan === "premium" ? "Premium" : "Pro"}
            </h2>
            <p>
              Status: <strong>{subscription.status}</strong>
            </p>
            {subscription.current_period_end && (
              <p>
                Current period ends: <strong>{new Date(subscription.current_period_end).toLocaleDateString()}</strong>
              </p>
            )}
            {subscription.cancel_at_period_end && (
              <p className="cancel-warning">
                Your membership is scheduled to cancel at the end of the current
                billing period.
              </p>
            )}
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button className="btn" onClick={openCustomerPortal} disabled={portalLoading || cancelLoading}>
                {portalLoading ? "Opening..." : "Manage Membership"}
              </button>
              {subscription.cancel_at_period_end ? (
                <button className="btn dark" onClick={resumeMembership} disabled={cancelLoading}>
                  {cancelLoading ? "Updating..." : "Keep Membership"}
                </button>
              ) : (
                <button className="btn dark" onClick={cancelMembership} disabled={cancelLoading}>
                  {cancelLoading ? "Canceling..." : "Cancel Membership"}
                </button>
              )}
            </div>
            <div className="legal-note">
              Billing is managed securely through Stripe. You can manage eligible
              subscription settings through the billing portal.
            </div>
          </div>
        ) : (
          <>
            <div className="section-heading">
              <div className="eyebrow">CHOOSE YOUR ACCESS</div>
              <h2>
                Built for players
                <br />
                making serious decisions.
              </h2>
              <p>Start with the level of research access that fits you.</p>
            </div>

            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:24}}>
              <button className={billingInterval==="month" ? "btn" : "btn dark"} onClick={()=>setBillingInterval("month")}>Monthly</button>
              <button className={billingInterval==="6_month" ? "btn" : "btn dark"} onClick={()=>setBillingInterval("6_month")}>6 Months · 15% OFF</button>
              <button className={billingInterval==="year" ? "btn" : "btn dark"} onClick={()=>setBillingInterval("year")}>1 Year · 10% OFF</button>
            </div>
            <div className="dashboard-card" style={{marginBottom:16}}><strong>Recommended: 6 months</strong><span className="muted"> Save 15% versus six monthly payments. Annual is also recommended for the best long-term value at 10% off.</span></div><div className="plans">
              <div className="plan-card">
                <div className="plan-top">
                  <div>
                    <div className="eyebrow">HOOPCHECK PRO</div>
                    <h3>Pro</h3>
                  </div>
                  <div className="price">
                    <strong>{billingInterval==="month" ? "$7.99" : billingInterval==="6_month" ? "$40.75" : "$86.29"}</strong>
                    <span>{billingInterval==="month" ? "/ month" : billingInterval==="6_month" ? "/ 6 months" : "/ year"}</span>
                  </div>
                </div>
                <p className="plan-description">
                  Full access to the core HoopCheck research experience.
                </p>
                <ul>
                  <li>Full coach ratings and reviews</li>
                  <li>Full team ratings and reviews</li>
                  <li>Full league ratings and reviews</li>
                  <li>Coach research</li>
                  <li>Team research</li>
                  <li>League research</li>
                </ul>
                <button
                  className="btn plan-button"
                  onClick={() => startCheckout("pro")}
                  disabled={checkoutLoading !== null || loading}
                >
                  {checkoutLoading === `pro-${billingInterval}` ? "Opening Checkout..." : `Get Pro — ${billingInterval === "month" ? "Monthly" : billingInterval === "6_month" ? "6 Months" : "1 Year"}`}
                </button>
              </div>

              <div className="plan-card featured">
                <div className="featured-badge">MORE ACCESS</div>
                <div className="plan-top">
                  <div>
                    <div className="eyebrow">HOOPCHECK PREMIUM</div>
                    <h3>Premium</h3>
                  </div>
                  <div className="price">
                    <strong>{billingInterval==="month" ? "$15.99" : billingInterval==="6_month" ? "$81.55" : "$172.69"}</strong>
                    <span>{billingInterval==="month" ? "/ month" : billingInterval==="6_month" ? "/ 6 months" : "/ year"}</span>
                  </div>
                </div>
                <p className="plan-description">
                  Everything in Pro plus expanded research capabilities.
                </p>
                <ul>
                  <li>Everything in Pro</li>
                  <li>Advanced research tools</li>
                  <li>Expanded coach insights</li>
                  <li>Expanded team insights</li>
                  <li>Expanded league insights</li>
                  <li>Premium discovery features</li>
                  <li>Priority access to new features</li>
                </ul>
                <button
                  className="btn plan-button"
                  onClick={() => startCheckout("premium")}
                  disabled={checkoutLoading !== null || loading}
                >
                  {checkoutLoading === `premium-${billingInterval}` ? "Opening Checkout..." : `Get Premium — ${billingInterval === "month" ? "Monthly" : billingInterval === "6_month" ? "6 Months" : "1 Year"}`}
                </button>
              </div>
            </div>

            <div className="subscription-legal">
              <p>
                By purchasing a HoopCheck membership, you agree to our{" "}
                <Link href="/terms">Terms of Service</Link> and acknowledge our{" "}
                <Link href="/privacy">Privacy Policy</Link>. Reviews and
                user-generated content are governed by our{" "}
                <Link href="/community-guidelines">Community Guidelines</Link>.
              </p>
              <p>
                Memberships are billed for the selected term at the price shown above. Monthly, 6-month, and annual subscriptions renew on their applicable renewal date until canceled. Cancellation and eligible billing management are
                available through the Stripe customer portal.
              </p>
              <p className="small">
                Taxes, where applicable, may be calculated and collected according
                to applicable laws and Stripe's billing configuration.
              </p>
            </div>
          </>
        )}
      </section>

      <section className="hero bottom-cta">
        <div className="eyebrow">KNOW BEFORE YOU GO</div>
        <h2>
          Your next contract
          <br />
          deserves research.
        </h2>
        <p>
          Don't rely on one conversation. Research the people, teams, and leagues
          that could shape your career.
        </p>
        <div className="actions">
          <Link href="/search" className="btn">
            Start Research
          </Link>
          <Link href="/dashboard" className="btn dark">
            Go to Dashboard
          </Link>
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
          <section className="hero membership-hero">
            <div className="eyebrow">HoopCheck Membership</div>
            <HoopLoading label="Loading membership..." />
          </section>
        </main>
      }
    >
      <MembershipContent />
    </Suspense>
  );
}
