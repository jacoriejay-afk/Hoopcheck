"use client";

import {
Suspense,
useEffect,
useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Plan = "pro" | "premium";

type Subscription = {
plan: Plan;
status: string;
current_period_end: string | null;
cancel_at_period_end: boolean;
};

function MembershipContent() {
const searchParams = useSearchParams();

const [subscription, setSubscription] =
useState<Subscription | null>(null);

const [loading, setLoading] = useState(true);
const [checkoutLoading, setCheckoutLoading] =
useState<Plan | null>(null);
const [portalLoading, setPortalLoading] =
useState(false);

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
  setError(
    "We couldn't load your membership status."
  );
} else {
  setSubscription(
    data as Subscription | null
  );
}
setLoading(false);

}

useEffect(() => {
loadSubscription();

const success = searchParams.get("success");
const canceled = searchParams.get("canceled");
if (success === "1") {
  setMessage(
    "Checkout completed. Your membership will appear here once Stripe confirms the subscription."
  );
}
if (canceled === "1") {
  setMessage(
    "Checkout was canceled. No subscription was created."
  );
}

}, [searchParams]);

async function startCheckout(plan: Plan) {
setCheckoutLoading(plan);
setError("");
setMessage("");

try {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    setError(
      "Please log in before purchasing a membership."
    );
    setCheckoutLoading(null);
    return;
  }
  const response = await fetch(
    "/api/stripe/create-checkout",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        plan,
      }),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data?.error ||
        "Unable to start checkout."
    );
  }
  if (!data?.url) {
    throw new Error(
      "Stripe did not return a checkout URL."
    );
  }
  window.location.href = data.url;
} catch (checkoutError) {
  console.error(
    "Checkout error:",
    checkoutError
  );
  setError(
    checkoutError instanceof Error
      ? checkoutError.message
      : "Unable to start checkout."
  );
  setCheckoutLoading(null);
}

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
    setError(
      "Please log in before managing your membership."
    );
    setPortalLoading(false);
    return;
  }
  const response = await fetch(
    "/api/stripe/create-portal",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data?.error ||
        "Unable to open billing portal."
    );
  }
  if (!data?.url) {
    throw new Error(
      "Stripe did not return a billing portal URL."
    );
  }
  window.location.href = data.url;
} catch (portalError) {
  console.error(
    "Portal error:",
    portalError
  );
  setError(
    portalError instanceof Error
      ? portalError.message
      : "Unable to open billing portal."
  );
  setPortalLoading(false);
}

}

const isActive =
subscription?.status === "active" ||
subscription?.status === "trialing";

return (
<main>
<nav className="nav">
  <Link href="/" className="logo">
    Hoop<span>Check</span>
  </Link>
    <div className="links">
      <Link href="/search">
        Search
      </Link>
      <Link href="/dashboard">
        Dashboard
      </Link>
      <Link
        href="/coaches"
        className="hide-mobile"
      >
        Coaches
      </Link>
      <Link
        href="/teams"
        className="hide-mobile"
      >
        Teams
      </Link>
      <Link
        href="/leagues"
        className="hide-mobile"
      >
        Leagues
      </Link>
    </div>
  </nav>
  <section className="hero membership-hero">
    <div className="eyebrow">
      HoopCheck Membership
    </div>
    <h1>
      Research deeper.
      <br />
      Decide smarter.
    </h1>
    <p>
      Unlock full coach, team, and league
      ratings and reviews from the players
      who have already been there.
    </p>
    <div className="hero-links">
      <Link href="/search">
        Global Research Search →
      </Link>
    </div>
  </section>
  {message && (
    <div className="status success">
      {message}
    </div>
  )}
  {error && (
    <div className="status error">
      {error}
    </div>
  )}
  <section className="membership-section">
    {isActive && subscription ? (
      <div className="active-card">
        <div className="eyebrow">
          CURRENT MEMBERSHIP
        </div>
        <h2>
          HoopCheck{" "}
          {subscription.plan === "premium"
            ? "Premium"
            : "Pro"}
        </h2>
        <p>
          Status:{" "}
          <strong>
            {subscription.status}
          </strong>
        </p>
        {subscription.current_period_end && (
          <p>
            Current period ends:{" "}
            <strong>
              {new Date(
                subscription.current_period_end
              ).toLocaleDateString()}
            </strong>
          </p>
        )}
        {subscription.cancel_at_period_end && (
          <p className="cancel-warning">
            Your membership is scheduled to
            cancel at the end of the current
            billing period.
          </p>
        )}
        <button
          className="btn"
          onClick={openCustomerPortal}
          disabled={portalLoading}
        >
          {portalLoading
            ? "Opening..."
            : "Manage Membership"}
        </button>
        <div className="legal-note">
          Billing is managed securely through
          Stripe. You can manage eligible
          subscription settings through the
          billing portal.
        </div>
      </div>
    ) : (
      <>
        <div className="section-heading">
          <div className="eyebrow">
            CHOOSE YOUR ACCESS
          </div>
          <h2>
            Built for players
            <br />
            making serious decisions.
          </h2>
          <p>
            Start with the level of research
            access that fits you.
          </p>
        </div>
        <div className="plans">
          <div className="plan-card">
            <div className="plan-top">
              <div>
                <div className="eyebrow">
                  HOOPCHECK PRO
                </div>
                <h3>Pro</h3>
              </div>
              <div className="price">
                <strong>
                  $7.99
                </strong>
                <span>
                  / month
                </span>
              </div>
            </div>
            <p className="plan-description">
              Full access to the core
              HoopCheck research experience.
            </p>
            <ul>
              <li>
                Full coach ratings and reviews
              </li>
              <li>
                Full team ratings and reviews
              </li>
              <li>
                Full league ratings and reviews
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
              className="btn plan-button"
              onClick={() =>
                startCheckout("pro")
              }
              disabled={
                checkoutLoading !== null ||
                loading
              }
            >
              {checkoutLoading === "pro"
                ? "Opening Checkout..."
                : "Get Pro"}
            </button>
          </div>
          <div className="plan-card featured">
            <div className="featured-badge">
              MORE ACCESS
            </div>
            <div className="plan-top">
              <div>
                <div className="eyebrow">
                  HOOPCHECK PREMIUM
                </div>
                <h3>Premium</h3>
              </div>
              <div className="price">
                <strong>
                  $15.99
                </strong>
                <span>
                  / month
                </span>
              </div>
            </div>
            <p className="plan-description">
              Everything in Pro plus expanded
              research capabilities.
            </p>
            <ul>
              <li>
                Everything in Pro
              </li>
              <li>
                Advanced research tools
              </li>
              <li>
                Expanded coach insights
              </li>
              <li>
                Expanded team insights
              </li>
              <li>
                Expanded league insights
              </li>
              <li>
                Premium discovery features
              </li>
              <li>
                Priority access to new features
              </li>
            </ul>
            <button
              className="btn plan-button"
              onClick={() =>
                startCheckout("premium")
              }
              disabled={
                checkoutLoading !== null ||
                loading
              }
            >
              {checkoutLoading === "premium"
                ? "Opening Checkout..."
                : "Get Premium"}
            </button>
          </div>
        </div>
        <div className="subscription-legal">
          <p>
            By purchasing a HoopCheck membership,
            you agree to our{" "}
            <Link href="/terms">
              Terms of Service
            </Link>{" "}
            and acknowledge our{" "}
            <Link href="/privacy">
              Privacy Policy
            </Link>
            . Reviews and user-generated content
            are governed by our{" "}
            <Link href="/community-guidelines">
              Community Guidelines
            </Link>
            .
          </p>
          <p>
            Memberships are billed monthly at the
            price shown above until canceled.
            Cancellation and eligible billing
            management are available through the
            Stripe customer portal.
          </p>
          <p className="small">
            Taxes, where applicable, may be
            calculated and collected according
            to applicable laws and Stripe's
            billing configuration.
          </p>
        </div>
      </>
    )}
  </section>
  <section className="hero bottom-cta">
    <div className="eyebrow">
      KNOW BEFORE YOU GO
    </div>
    <h2>
      Your next contract
      <br />
      deserves research.
    </h2>
    <p>
      Don't rely on one conversation.
      Research the people, teams, and leagues
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
  <style jsx>{`
    .membership-hero {
      padding-bottom: 35px;
    }
    .hero-links {
      margin-top: 25px;
    }
    .hero-links a {
      color: var(--orange);
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 13px;
    }
    .status {
      max-width: 900px;
      margin: 10px auto 0;
      padding: 14px 18px;
      border-radius: 9px;
      font-size: 14px;
    }
    .status.success {
      background: #102417;
      border: 1px solid #245d35;
      color: #b9f0c8;
    }
    .status.error {
      background: #241010;
      border: 1px solid #6b2424;
      color: #ffb1b1;
    }
    .membership-section {
      max-width: 1180px;
      margin: 0 auto;
      padding: 50px 24px 90px;
    }
    .active-card {
      max-width: 700px;
      margin: 0 auto;
      background: #111;
      border: 1px solid #292929;
      border-top: 4px solid var(--orange);
      border-radius: 18px;
      padding: 40px;
    }
    .active-card h2 {
      font-size: 36px;
      margin: 10px 0 25px;
    }
    .active-card p {
      color: #bbb;
      line-height: 1.7;
    }
    .cancel-warning {
      color: #ffb26b !important;
    }
    .legal-note {
      margin-top: 25px;
      padding-top: 20px;
      border-top: 1px solid #292929;
      color: #888;
      font-size: 12px;
      line-height: 1.6;
    }
    .section-heading {
      text-align: center;
      max-width: 650px;
      margin: 0 auto 45px;
    }
    .section-heading h2 {
      font-size: clamp(34px, 5vw, 54px);
      line-height: 1;
      margin: 12px 0 18px;
    }
    .section-heading p {
      color: #aaa;
      line-height: 1.7;
    }
    .plans {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 25px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .plan-card {
      position: relative;
      background: #111;
      border: 1px solid #292929;
      border-radius: 18px;
      padding: 35px;
    }
    .plan-card.featured {
      border-color: var(--orange);
      box-shadow: 0 15px 50px rgba(255, 106, 0, 0.08);
    }
    .featured-badge {
      position: absolute;
      top: 0;
      right: 25px;
      transform: translateY(-50%);
      padding: 7px 12px;
      background: var(--orange);
      color: #000;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.08em;
    }
    .plan-top {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
    }
    .plan-card h3 {
      font-size: 32px;
      margin: 8px 0 0;
    }
    .price {
      text-align: right;
      white-space: nowrap;
    }
    .price strong {
      display: block;
      color: var(--orange);
      font-size: 30px;
    }
    .price span {
      color: #888;
      font-size: 12px;
    }
    .plan-description {
      color: #aaa;
      line-height: 1.6;
      margin: 25px 0;
    }
    .plan-card ul {
      padding-left: 20px;
      color: #ddd;
      line-height: 1.9;
      min-height: 230px;
    }
    .plan-button {
      width: 100%;
      border: 0;
      cursor: pointer;
    }
    .plan-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .subscription-legal {
      max-width: 850px;
      margin: 35px auto 0;
      padding: 20px 22px;
      background: #0d0d0d;
      border: 1px solid #292929;
      border-radius: 12px;
    }
    .subscription-legal p {
      color: #999;
      font-size: 12px;
      line-height: 1.7;
      margin: 0 0 10px;
    }
    .subscription-legal p:last-child {
      margin-bottom: 0;
    }
    .subscription-legal a {
      color: var(--orange);
      font-weight: 800;
    }
    .subscription-legal .small {
      color: #777;
    }
    .bottom-cta {
      margin-top: 0;
    }
    @media (max-width: 800px) {
      .plans {
        grid-template-columns: 1fr;
      }
      .plan-card ul {
        min-height: auto;
      }
      .hide-mobile {
        display: none;
      }
    }
    @media (max-width: 600px) {
      .membership-section {
        padding-left: 16px;
        padding-right: 16px;
      }
      .active-card,
      .plan-card {
        padding: 25px 20px;
      }
      .plan-top {
        flex-direction: column;
      }
      .price {
        text-align: left;
      }
    }
  `}</style>
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
