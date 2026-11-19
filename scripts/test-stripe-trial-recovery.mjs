import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/stripe-trial-recovery.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { canReleaseExpiredTrialSession: allowed } =
  await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const user = "11111111-1111-4111-8111-111111111111";
const id = "cs_test_expired";
const base = {
  mode: "subscription", status: "expired", subscription: null,
  payment_status: "unpaid", client_reference_id: user,
  metadata: { user_id: user, stripe_trial_reserved: "true" }
};
assert.equal(allowed(base, user, id, id), true);
for (const [name, change] of [
  ["open", { status: "open" }],
  ["completed", { status: "complete" }],
  ["subscription attached", { subscription: "sub_test" }],
  ["paid", { payment_status: "paid" }],
  ["wrong mode", { mode: "payment" }],
  ["different owner", { client_reference_id: "another" }],
  ["metadata owner mismatch", { metadata: { user_id: "another", stripe_trial_reserved: "true" } }],
  ["no trial flag", { metadata: { user_id: user } }]
]) {
  assert.equal(allowed({ ...base, ...change }, user, id, id), false, name);
}
assert.equal(allowed(base, user, id, "cs_test_other"), false, "session mismatch");
assert.equal(allowed(base, user, "not-a-session", "not-a-session"), false, "invalid ID");
console.log("Stripe trial recovery policy: 11 cases passed");
