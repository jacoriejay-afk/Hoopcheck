import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checkout = readFileSync("app/api/stripe/webhook/create-checkout/route.ts", "utf8");
const webhook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
const trialPolicy = readFileSync("lib/stripe-trial-eligibility.ts", "utf8");
const membership = readFileSync("app/membership/page.tsx", "utf8");
const migration = readFileSync("scripts/sql/stripe-trial-claims-proposal.sql", "utf8");

assert.ok(membership.includes("one-time seven-day free trial") &&
  membership.includes("not currently available at public checkout"),
  "Public membership copy must disclose that the all-user trial is not yet live");
// The public trial stays disabled. Only the pinned, branch-scoped isolated
// test environment can issue a trial for authenticated sandbox acceptance.
for (const required of [
  'process.env.VERCEL_ENV === "preview"',
  'process.env.VERCEL_GIT_COMMIT_REF === "fix/website-membership-layout-20261121"',
  'process.env.HOOPCHECK_STRIPE_SANDBOX_TRIAL_ENABLED === "true"',
  'process.env.NEXT_PUBLIC_SUPABASE_URL === "https://vcprqpjkyubzzcjatdpx.supabase.co"',
  'process.env.HOOPCHECK_STRIPE_TEST_SUPABASE_URL === process.env.NEXT_PUBLIC_SUPABASE_URL',
  'siteUrl === "https://hoopcheck-stripe-sandbox-git-fix-website-membe-b926cc-hoopcheck.vercel.app"',
  'stripeConfigMatches && configuredMode === "test"',
]) {
  assert.ok(checkout.includes(required), `Trial test rollout missing required isolation guard: ${required}`);
}
assert.ok(checkout.includes('const trialRolloutEnabled ='), "Sandbox trial gate must be explicit");
assert.doesNotMatch(checkout, /const trialRolloutEnabled = true;/, "Trial must never enable unconditionally");
assert.match(checkout, /\.\.\.\(trialEligible \? \{ trial_period_days: 7 \} : \{\}\)/,
  "Stripe trial must only be issued through eligibility gate");
assert.ok(trialPolicy.includes("isSupportedSubscriptionAccountType(input.accountType)"),
  "All currently supported billing roles may receive one trial");
assert.ok(checkout.includes("if (!isSupportedSubscriptionAccountType(checkoutProfile.account_type))"),
  "Checkout must reject roles the webhook cannot activate");
assert.ok(webhook.includes("if (!isSupportedSubscriptionAccountType(ownerProfile.account_type))"),
  "Webhook and Checkout must share the same account-type eligibility");
assert.ok(!trialPolicy.includes('input.accountType === "player"'),
  "Trial eligibility must not be Player-only");
assert.ok(!checkout.includes('trialRolloutEnabled && checkoutProfile.account_type === "player"'),
  "Initial trial gate must include all valid account types");
assert.ok(checkout.includes("rolloutEnabled: trialRolloutEnabled,"),
  "Final eligibility gate must not restrict trials by account type");
assert.ok(membership.includes("all supported HoopCheck account types"),
  "Public trial notice must describe all supported account types");
assert.match(migration, /user_id uuid primary key/,
  "Claims must be unique per user");
assert.match(migration, /revoke all on function public\.reserve_stripe_trial\(uuid\) from public, anon, authenticated/,
  "Reservation RPC must not be callable by public roles");
assert.match(migration, /'reserved', 'redeemed', 'expired'/,
  "Expired reservations must remain terminal");
assert.match(migration, /set state = 'expired'/,
  "Expiration must retain the claim rather than delete it");
assert.doesNotMatch(migration, /delete from public[.]stripe_trial_claims/i,
  "Never delete a trial claim during recovery");
assert.match(checkout, /"reserve_stripe_trial"/,
  "Checkout must reserve atomically before trial creation");
assert.match(checkout, /"bind_stripe_trial_session"/,
  "Checkout must bind the trial session");
assert.ok(checkout.includes("canReuseOpenTrialSession(existingSession, user.id, claim.checkout_session_id)"), "Existing trial checkout must be verified");
assert.ok(checkout.includes("claim?.state === \"reserved\""), "Only reserved claims can be reused");
assert.ok(checkout.includes("existingSession.metadata?.plan === plan"), "Plan must match");
assert.ok(checkout.includes("existingSession.metadata?.billing_interval === interval"), "Interval must match");
assert.ok(checkout.includes("await stripe.checkout.sessions.expire(session.id)"), "Unbound checkout must expire");
assert.ok(checkout.includes("\"reserve_stripe_trial\""), "Reservation must be present");
assert.ok(checkout.includes("const emailCustomers = user.email"), "Trial eligibility must inspect all Stripe customers matching the email");
assert.ok(checkout.includes("const linkedCustomer = customerId"), "Trial eligibility must also inspect the linked Stripe customer");
assert.ok(checkout.includes("emailCustomers.some((customer) => customer.id === linkedCustomer.id)"), "Duplicate customer records must be deduplicated");
assert.ok(checkout.includes("emailCustomers.length === 100"), "Truncated customer history must fail closed");
assert.ok(checkout.includes('status: "all"'), "Historical canceled subscriptions must be included");
assert.ok(checkout.includes("allow_promotion_codes: !promoCodeId && !trialEligible"), "Trial checkout must disable hosted promotion-code stacking");
assert.ok(checkout.includes('automatic_tax: { enabled: true }'), "Trial Checkout must enable Stripe Tax");
assert.ok(checkout.includes('billing_address_collection: "required"'), "Trial Checkout must collect the billing address for tax");
assert.ok(webhook.includes('event.type ===\n      "checkout.session.completed"'), "Trial redemption must be in completed Checkout webhook");
assert.ok(webhook.includes('session.metadata?.user_id !== userId'), "Webhook must verify Checkout user identity");
assert.ok(webhook.includes('subscription.metadata?.user_id !== userId'), "Webhook must verify subscription user identity");
assert.ok(webhook.includes('session.metadata?.stripe_trial_reserved === "true"'), "Trial redemption must require reservation marker");
assert.ok(webhook.includes('subscription.status !== "trialing"'), "Trial redemption must require trialing subscription");
assert.ok(webhook.includes('subscription.metadata?.stripe_trial_reserved !== "true"'), "Subscription must carry trial marker");
assert.ok(webhook.includes('event.type === "checkout.session.expired"'), "Webhook must handle signed Checkout expiration");
assert.ok(webhook.includes('expiredSession.metadata?.stripe_trial_reserved === "true"'), "Expire only explicitly reserved trials");
assert.ok(webhook.includes('expiredSession.metadata?.user_id !== userId'), "Expired event must prove owner metadata");
assert.ok(webhook.includes('claim?.state === "reserved" && claim.checkout_session_id === expiredSession.id'), "Expire only exact bound reservation");
assert.ok(webhook.includes('stripe.checkout.sessions.retrieve(expiredSession.id)'), "Expiry must be re-verified directly with Stripe");
assert.ok(webhook.includes('canReleaseExpiredTrialSession('), "Expiry must apply conservative Stripe session policy");
assert.ok(webhook.includes('"mark_expired_stripe_trial"'), "Expiry must retain terminal claim via service-role RPC");
assert.ok(webhook.indexOf('stripe.checkout.sessions.retrieve(expiredSession.id)') < webhook.indexOf('"mark_expired_stripe_trial"'), "Expiry must verify Stripe session before mutation");
assert.ok(webhook.includes('expireError || expired !== true'), "Failed expiration RPC must return retryable webhook error");
assert.ok(webhook.includes('"redeem_stripe_trial"'), "Webhook must redeem bound claim");
assert.ok(webhook.indexOf('"redeem_stripe_trial"') < webhook.indexOf('await saveSubscription(userId, subscription);'), "Trial claim must redeem before membership is saved");
assert.ok(checkout.includes('if (!session.url || (trialEligible && !isTrustedStripeCheckoutUrl(session.url))) {'), "Checkout must reject missing hosted URL");
assert.ok(checkout.includes('Unable to expire trial checkout with missing or untrusted URL'), "Trial session without hosted URL must be expired for reconciliation");
assert.ok(webhook.includes('subscription.metadata?.stripe_trial_reserved === "true"'), "All subscription sync paths must inspect trial marker");
assert.ok(webhook.includes('claim?.state !== "redeemed"'), "Subscription sync must reject unredeemed trial claims");
assert.ok(webhook.includes('Trial subscription owner metadata mismatch.'), "Subscription sync must validate trial owner");
console.log("Trial release and webhook safety checks passed (public trial disabled, pinned sandbox test only).");
