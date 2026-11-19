import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/stripe-trial-eligibility.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { isEligibleForSevenDayTrial: eligible } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

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
for (const [name, override] of [
  ["rollout disabled", { rolloutEnabled: false }],
  ["fan excluded", { accountType: "fan" }],
  ["coach excluded", { accountType: "coach" }],
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
console.log("Stripe seven-day trial eligibility policy: 11 cases passed");
