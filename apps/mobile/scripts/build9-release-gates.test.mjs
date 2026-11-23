import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REQUIRED_GATE_IDS, WAIVABLE_GATE_IDS, missingRequiredGateIds, nonWaivableWaivers } from "./build9-required-gates.mjs";

const snapshot = JSON.parse(readFileSync(new URL("../../../reports/build9/release/build9-gates.json", import.meta.url), "utf8"));

test("Build 9 manifest explicitly includes every non-droppable release gate", () => {
  assert.deepEqual(missingRequiredGateIds(snapshot.gates), []);
  assert.equal(new Set(REQUIRED_GATE_IDS).size, REQUIRED_GATE_IDS.length);
  assert.equal(new Set(snapshot.gates.map(g => g.id)).size, snapshot.gates.length);
});

test("privileged profile ACL remains blocked until isolated and signed acceptance", () => {
  const gate = snapshot.gates.find(g => g.id === "privileged_profile_update_acl");
  assert.equal(gate.status, "HOLD");
  assert.match(gate.details, /table-wide UPDATE/);
  assert.match(gate.details, /Build 7\/8/);
});

test("deleting any mandatory gate is rejected even if checklist retains other entries", () => {
  for (const removed of REQUIRED_GATE_IDS) {
    const reduced = snapshot.gates.filter(g => g.id !== removed);
    assert.ok(missingRequiredGateIds(reduced).includes(removed), removed);
  }
  assert.deepEqual(missingRequiredGateIds([]), REQUIRED_GATE_IDS);
});

test("owner may waive ONLY the production-schema rehearsal, without marking it passed", () => {
  const waiver = snapshot.gates.find(g => g.id === "production_schema_rehearsal");
  assert.equal(waiver.status, "WAIVED");
  assert.match(waiver.details, /unverified/i);
  assert.match(waiver.details, /no production/i);
  assert.match(waiver.evidence, /^https:\/\//);
  assert.deepEqual(WAIVABLE_GATE_IDS, ["production_schema_rehearsal"]);
  assert.deepEqual(nonWaivableWaivers(snapshot.gates), []);
  for (const id of REQUIRED_GATE_IDS.filter(id => id !== "production_schema_rehearsal")) {
    assert.deepEqual(nonWaivableWaivers([{ id, status: "WAIVED" }]), [id], id);
  }
  assert.equal(snapshot.gates.find(g => g.id === "owner_mfa_signed_http").status, "HOLD");
  assert.equal(snapshot.gates.find(g => g.id === "build7_8_compatibility").status, "HOLD");
  assert.equal(snapshot.gates.find(g => g.id === "physical_iphone").status, "HOLD");
  assert.equal(snapshot.gates.find(g => g.id === "apple_sandbox_subscriptions").status, "HOLD");
});
