import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checkout = readFileSync("app/api/stripe/webhook/create-checkout/route.ts", "utf8");
const trialPolicy = readFileSync("lib/stripe-trial-eligibility.ts", "utf8");
const migration = readFileSync("scripts/sql/stripe-trial-claims-proposal.sql", "utf8");

assert.match(checkout, /const trialRolloutEnabled = false;/,
  "Trial issuance must remain hard-disabled until reservation and webhook integration are verified");
assert.match(checkout, /\.\.\.\(trialEligible \? \{ trial_period_days: 7 \} : \{\}\)/,
  "Stripe trial must only be issued through eligibility gate");
assert.match(trialPolicy, /input\.accountType === "player"/,
  "Only Player accounts may receive the trial");
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
console.log("Trial release safety checks passed (trial issuance disabled).");
