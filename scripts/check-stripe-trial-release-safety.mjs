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
assert.match(checkout, /canReuseOpenTrialSession\\(existingSession, user\\.id, claim\\.checkout_session_id\\)/,
  "Existing trial checkout may only be reused after server-side session verification");
assert.match(checkout, /claim\\?\\.state === "reserved"/,
  "Only reserved claims may reuse an open checkout");
assert.match(checkout, /existingSession\\.metadata\\?\\.plan === plan/,
  "A reused checkout must match the requested plan");
assert.match(checkout, /existingSession\\.metadata\\?\\.billing_interval === interval/,
  "A reused checkout must match the billing interval");
assert.match(checkout, /await stripe\\.checkout\\.sessions\\.expire\\(session\\.id\\)/,
  "An unbound trial checkout must be expired rather than returned to a user");
assert.match(checkout, /if \\(trialEligible\\) \\{[\\s\\S]*?reserve_stripe_trial/,
  "Trial checkout must be reserved before Stripe session creation");
console.log("Trial release safety checks passed (trial issuance disabled).");
