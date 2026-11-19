import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/stripe-trial-recovery.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { canReleaseExpiredTrialSession: allowed, reconcileExpiredTrialReservation: reconcile } =
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

const calls = [];
const retrieve = async (sessionId) => { calls.push(["retrieve",sessionId]); return { ...base, id }; };
const release = async (uid, sessionId) => { calls.push(["release",uid,sessionId]); return true; };
assert.equal(await reconcile(user,id,retrieve,release),"released");
assert.deepEqual(calls,[["retrieve",id],["release",user,id]]);
calls.length=0;
assert.equal(await reconcile(user,id,async () => ({...base,id,status:"complete"}),release),"retained");
assert.deepEqual(calls,[],"completed checkout must never call release");
assert.equal(await reconcile(user,id,async () => ({...base,id,subscription:"sub_test"}),release),"retained");
assert.equal(await reconcile(user,id,async () => ({...base,id}),async () => false),"retained");
await assert.rejects(reconcile(user,id,async () => { throw new Error("stripe unavailable"); },release));
await assert.rejects(reconcile(user,id,retrieve,async () => { throw new Error("database unavailable"); }));
assert.equal(await reconcile(user,"invalid",retrieve,release),"retained");
console.log("Stripe trial reconciliation: 7 additional cases passed");
