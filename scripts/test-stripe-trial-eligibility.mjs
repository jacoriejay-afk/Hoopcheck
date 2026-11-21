import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/stripe-trial-eligibility.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { isEligibleForSevenDayTrial: eligible, isSupportedSubscriptionAccountType: supported } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const baseline = {
  rolloutEnabled: true,
  interval: "month",
  accountType: "player",
  hasPromoCode: false,
  hasExistingSubscription: false,
  hasVerifiedEmail: true,
  customerLookupComplete: true,
  hasPriorStripeSubscription: false,
};
assert.equal(eligible(baseline), true, "eligible first-time monthly user");
// Every supported account gets the same one-time monthly policy; plan
// restrictions (including Premium-only Coach/Manager) remain in the API.
for (const accountType of [
  "player", "fan", "coach", "manager", "agent", "scout", "club_admin",
]) {
  assert.equal(supported(accountType), true, `${accountType} is a supported billing role`);
  assert.equal(eligible({ ...baseline, accountType }), true,
    `${accountType} receives the first-time monthly trial policy`);
}
for (const accountType of ["", "  ", null, undefined, "admin", "creator", "future_account_type"]) {
  assert.equal(supported(accountType), false,
    "invalid or not-yet-billable account type is denied before Checkout");
  assert.equal(eligible({ ...baseline, accountType }), false,
    "unsupported role must not start an unfulfillable trial");
}
for (const [name, override] of [
  ["rollout disabled", { rolloutEnabled: false }],
  ["six month", { interval: "6_month" }],
  ["annual", { interval: "year" }],
  ["promotion code", { hasPromoCode: true }],
  ["existing subscription", { hasExistingSubscription: true }],
  ["unverified email", { hasVerifiedEmail: false }],
  ["incomplete lookup", { customerLookupComplete: false }],
  ["prior subscription", { hasPriorStripeSubscription: true }],
]) {
  assert.equal(eligible({ ...baseline, ...override }), false, name);
}
console.log("Stripe seven-day trial eligibility policy: 23 role and safety cases passed");
