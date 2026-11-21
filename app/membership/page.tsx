"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import HoopLoading from "../../components/HoopLoading";
import MembershipComparison from "../../components/MembershipComparison";
import { BILLING_LABELS, PLAN_PRICES } from "../../lib/plan-comparison";
import { getActiveMembershipTier } from "../../lib/membership-tier";
import { readDeadline } from "../../lib/billing/client-membership-core";
import { getEffectiveMembership } from "../../lib/billing/client-membership";
import type { EffectiveMembership } from "../../lib/billing/membership";
import { supabase } from "../../lib/supabase";
type Plan = "pro" | "premium";
type BillingInterval = "month" | "6_month" | "year";
type StripeBilling = { plan: Plan | null; status: string; current_period_end: string | null; cancel_at_period_end: boolean; stripe_subscription_id: string | null; stripe_customer_id: string | null };
function MembershipContent() {
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<EffectiveMembership | null>(null);
  const [appleBillingKnown, setAppleBillingKnown] = useState(false);
  const [billing, setBilling] = useState<StripeBilling | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null), [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState("");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const [authRevision, setAuthRevision] = useState(0);
  const generation = useRef(0), acting = useRef(false), authEpoch = useRef(0);
  const invalidate = useCallback(() => { generation.current++; authEpoch.current++; }, []);
  const loadSubscription = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setError(""); setSubscription(null); setBilling(null); setAppleBillingKnown(false); setAccountType(null); setUserId("");
    const controller = new AbortController(); let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([(async () => {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw Error("Your sign-in could not be verified. Try again.");
        if (!user) return;
        const [profile, effective, stripe, apple] = await Promise.all([
          supabase.from("profiles").select("account_type").eq("id", user.id).abortSignal(controller.signal).maybeSingle(),
          getEffectiveMembership(user.id),
          supabase.from("subscriptions").select("plan,status,current_period_end,cancel_at_period_end,stripe_subscription_id,stripe_customer_id").eq("user_id", user.id).abortSignal(controller.signal).maybeSingle(),
          supabase.from("apple_memberships").select("status").eq("user_id", user.id).limit(1).abortSignal(controller.signal).maybeSingle(),
        ]);
        if (current !== generation.current || controller.signal.aborted) return;
        if (profile.error || effective.error || stripe.error || apple.error || !profile.data) throw Error("We couldn't verify your membership and billing. Refresh before making changes.");
        setUserId(user.id); setAccountType(profile.data.account_type); setSubscription(effective.data); setBilling(stripe.data); setAppleBillingKnown(Boolean(apple.data));
      })(), new Promise<never>((_, reject) => { deadline = setTimeout(() => { controller.abort(); reject(Error("Membership verification timed out. Please try again.")); }, 30000); })]);
    } catch (value) { if (current === generation.current) setError(value instanceof Error ? value.message : "Membership could not be verified."); }
    finally { clearTimeout(deadline); controller.abort(); if (current === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === "INITIAL_SESSION") return;
      invalidate(); setSubscription(null); setBilling(null); setAppleBillingKnown(false); setAccountType(null); setUserId(""); setMessage(""); setAuthRevision(value => value + 1);
    });
    return () => { data.subscription.unsubscribe(); invalidate(); };
  }, [invalidate]);
  useEffect(() => {
    void loadSubscription();
    if (searchParams.get("canceled") === "true") setMessage("Checkout was canceled. No subscription was confirmed.");
    if (searchParams.get("success") !== "true") return;
    setMessage("Checkout completed. Confirming membership with the billing provider…");
    let attempts = 0;
    const timer = setInterval(() => { void loadSubscription(); if (++attempts >= 6) { clearInterval(timer); setMessage("Refresh to check your verified membership. Checkout completion alone does not confirm access."); } }, 2000);
    return () => clearInterval(timer);
  }, [loadSubscription, searchParams, authRevision]);
  async function billingAction(action: string, path: string, body?: Record<string, unknown>) {
    if (acting.current || loading || !userId) return;
    acting.current = true; setBusy(action); setError(""); setMessage("");
    const captured = authEpoch.current;
    try {
      const { data: { session }, error: sessionError } = await readDeadline(() => supabase.auth.getSession(), 10000);
      if (sessionError || session?.user.id !== userId || captured !== authEpoch.current) throw Error("Your account changed. Refresh before managing billing.");
      const controller = new AbortController();
      let value;
      try {
      value = await readDeadline(async () => {
      const response = await fetch(path, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store", redirect: "error", signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw Error(payload?.error || "Billing could not be confirmed. Refresh before retrying.");
      return payload;
      }, 30000);
      } finally { controller.abort(); }
      if (captured !== authEpoch.current) return;
      if (value.url) {
        const target = new URL(value.url);
        if (target.protocol !== "https:" || !["checkout.stripe.com", "billing.stripe.com"].includes(target.hostname) || target.username || target.password || target.port) throw Error("The secure billing destination could not be verified.");
        window.location.assign(target.toString());
      } else { await loadSubscription(); if (captured === authEpoch.current) setMessage("Billing updated. Your current access is verified separately above."); }
    } catch (value) { if (captured === authEpoch.current) setError(value instanceof Error ? value.message : "Billing could not be confirmed."); }
    finally { acting.current = false; setBusy(""); }
  }
  const currentTier = getActiveMembershipTier(subscription), isActive = currentTier !== "free";
  const premiumOnlyAccount = accountType === "coach" || accountType === "manager";
  const stripeOngoing = Boolean(billing?.stripe_subscription_id && ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(billing.status));
  const appleOngoing = subscription?.provider === "apple" && isActive;
  const canBuy = !loading && !error && Boolean(userId && accountType && ["player", "coach", "manager", "scout", "agent", "club_admin"].includes(accountType)) && !stripeOngoing && !appleOngoing;
  const checkout = (plan: Plan, interval = billingInterval, code?: string) => {
    if (!canBuy || premiumOnlyAccount && plan !== "premium") return;
    void billingAction("checkout", "/api/stripe/webhook/create-checkout", { plan, interval, ...(code?.trim() ? { promoCode: code.trim() } : {}) });
  };
  return <main className="hc-membership-page">
    <section className="hero membership-hero"><div className="eyebrow">HoopCheck Membership</div><h1>Research deeper.<br />Decide smarter.</h1><p>Research teams, coaches and leagues through first-hand basketball experiences. Existing role, verification and moderation rules apply to every membership.</p><div className="hero-links"><Link href="/search">Global Research Search →</Link></div></section>
    {loading ? <HoopLoading label="Verifying membership and billing…" /> : null}
    {error ? <div className="status error" role="alert">{error}</div> : null}
    {message ? <div className="status success" role="status">{message}</div> : null}
    <section className="membership-section">
      {isActive && subscription && <div className="active-card" id="manage-subscription"><div className="eyebrow">CURRENT MEMBERSHIP</div><h2>HoopCheck {currentTier === "premium" ? "Premium" : "Pro"}</h2><p>Verified access: <strong>{subscription.status}</strong> · {subscription.provider === "apple" ? "Apple" : subscription.provider === "stripe" ? "Stripe" : "HoopCheck"}</p>{subscription.current_period_end ? <p>Current period ends: <strong>{new Date(subscription.current_period_end).toLocaleDateString()}</strong></p> : null}{subscription.cancel_at_period_end ? <p className="cancel-warning">Renewal is cancelled. Access continues until the verified period ends.</p> : null}
        {subscription.provider === "apple" ? <><p>Manage, change or cancel Apple billing in Apple subscriptions. Restore purchases from Membership in the HoopCheck iPhone app. Stripe controls cannot change Apple billing.</p><a className="btn" href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer">Manage Apple subscription</a><p className="legal-note">Deleting HoopCheck or signing out does not cancel an Apple subscription.</p></> : subscription.provider === "manual" ? <p>Your existing membership is active. Contact support to change a membership managed by HoopCheck.</p> : null}
      </div>}
      {appleBillingKnown && subscription?.provider !== "apple" ? <div className="dashboard-card"><h2>Apple billing and restoration</h2><p>You also have Apple purchase history. Manage any Apple renewal with Apple, even when your current HoopCheck access comes from another provider. Restore purchases in the HoopCheck iPhone app.</p><a className="btn" href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer">Manage Apple subscription</a></div> : null}
      {subscription?.provider === "apple" && !isActive ? <div className="dashboard-card"><h2>Apple billing and restoration</h2><p>Current access is inactive or needs verification. Manage Apple billing or restore purchases in the HoopCheck iPhone app before changing billing providers.</p><a className="btn" href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer">Manage Apple subscription</a></div> : null}
      {billing?.stripe_customer_id || billing?.stripe_subscription_id ? <div className="dashboard-card" id="stripe-billing"><div className="eyebrow">STRIPE BILLING</div><h2>{subscription?.provider === "apple" ? "Separate Stripe billing" : "Manage Stripe membership"}</h2><p>Status: {billing.status}. Stripe invoices and cancellation affect Stripe billing only.</p><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="btn" disabled={Boolean(busy) || loading} onClick={() => void billingAction("portal", "/api/stripe/create-portal")}>{busy === "portal" ? "Opening billing…" : "Manage / Upgrade Plan"}</button>{stripeOngoing ? <button className="btn dark" disabled={Boolean(busy) || loading} onClick={() => {
        if (!billing.cancel_at_period_end && !window.confirm("Cancel Stripe renewal at the end of your current billing period? This does not cancel Apple billing.")) return;
        void billingAction("cancel", "/api/stripe/cancel-subscription", { action: billing.cancel_at_period_end ? "resume" : "cancel" });
      }}>{busy === "cancel" ? "Updating…" : billing.cancel_at_period_end ? "Keep Membership" : "Cancel Membership"}</button> : null}</div></div> : null}
      {accountType === "fan" ? <div className="dashboard-card"><h2>Fan membership status</h2><p>Paid fan products have not been priced and are not offered for purchase. Existing Pro and Premium entitlements, renewals and billing-management access remain unchanged.</p><Link className="btn" href="/team-hub/groups">Explore HoopGroups</Link></div> : null}
      {isActive && subscription && <MembershipComparison audience={accountType === "fan" ? "fan" : "player"} currentTier={currentTier} billingTerm={billingInterval} premiumOnly={premiumOnlyAccount} />}
      {!isActive && accountType !== "fan" ? <><div className="section-heading"><div className="eyebrow">CHOOSE YOUR ACCESS</div><h2>{premiumOnlyAccount ? "Premium for coaches and team managers." : "Built for basketball professionals."}</h2><p>Choose a billing period. New purchases are available after your account and current billing are verified.</p></div><div className="hc-billing-options" role="group" aria-label="Choose billing term">{(["month", "6_month", "year"] as const).map(term => <button key={term} type="button" aria-pressed={billingInterval === term} className="hc-billing-option" onClick={() => setBillingInterval(term)}><span>{term === "month" ? "Monthly" : term === "6_month" ? "6 months" : "Annual"}</span><small>{BILLING_LABELS[term]}</small></button>)}</div>
        {accountType === "player" && billingInterval === "month" ? <p className="hc-trial-note" role="note"><strong>7-day trial update:</strong> A seven-day free trial for first-time monthly Player Pro and Premium memberships is being prepared, but it is not currently available at checkout. Your selected monthly price and any applicable taxes or discounts are shown before payment.</p> : null}
        <div className="plans">{!premiumOnlyAccount ? <div className="plan-card"><div className="eyebrow">HOOPCHECK PRO</div><h3>Pro</h3><div className="price"><strong>{PLAN_PRICES.pro[billingInterval]}</strong><span>{BILLING_LABELS[billingInterval]}</span></div><p>Full coach, team and league reviews, HoopFeed and eligible research tools.</p><button className="btn plan-button" disabled={!canBuy || Boolean(busy)} onClick={() => checkout("pro")}>Get Pro — {billingInterval === "month" ? "Monthly" : billingInterval === "6_month" ? "6 Months" : "1 Year"}</button></div> : null}<div className="plan-card featured"><div className="eyebrow">HOOPCHECK PREMIUM</div><h3>Premium</h3><div className="price"><strong>{PLAN_PRICES.premium[billingInterval]}</strong><span>{BILLING_LABELS[billingInterval]}</span></div><p>Pro benefits with eligible Premium tools for your account.</p><button className="btn plan-button" disabled={!canBuy || Boolean(busy)} onClick={() => checkout("premium")}>Get Premium — {billingInterval === "month" ? "Monthly" : billingInterval === "6_month" ? "6 Months" : "1 Year"}</button></div></div>

      </> : null}
      {!loading && !userId && !error ? <Link href="/login?returnTo=%2Fmembership" className="btn">Sign in to verify membership</Link> : null}
      <button className="btn dark" disabled={loading || Boolean(busy)} onClick={() => void loadSubscription()}>Refresh membership</button>
      <div className="subscription-legal"><p>Subscriptions renew for the displayed billing period until cancelled through the original provider. Apple purchase and trial terms are confirmed separately in the iPhone app. Taxes may apply.</p><p>By purchasing, you agree to our <Link href="/terms">Terms of Service</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/community-guidelines">Community Guidelines</Link>.</p></div>
    </section>
  </main>;
}
export default function MembershipPage() {
  return <Suspense fallback={<main><HoopLoading label="Loading membership…" /></main>}><MembershipContent /></Suspense>;
}
