import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
const script = new URL("./check-build9-release-readiness.mjs", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(new URL("../../../reports/build9/release/build9-gates.json", import.meta.url), "utf8"));
const run = (args = [], env = {}) => spawnSync(process.execPath, [script, ...args], {
  encoding:"utf8",
  env: {...process.env, HOOPCHECK_APPROVED_IOS_BUNDLE_ID:"", BUILD9_RELEASE_COMMIT:"", ...env}
});
test("Build 9 source/EAS preflight validates documented native features", () => {
  const x=run();
  assert.equal(x.status, 0, x.stderr);
  assert.match(x.stdout,/VERIFIED LOCALLY/);
  assert.match(x.stdout,/HOLD:/);
});
test("Build 9 production release cannot pass with known security or iPhone gates outstanding", () => {
  const x=run(["--release"], {HOOPCHECK_APPROVED_IOS_BUNDLE_ID:manifest.build.bundle_id});
  assert.equal(x.status, 2);
  assert.match(x.stderr,/BUILD 9 RELEASE HOLD:/);
  assert.match(x.stderr,/owner_mfa_signed_http/);
});
test("Build 9 release requires distinct status evidence and pinned source commit", () => {
  assert.equal(manifest.release_commit,null);
  assert.ok(manifest.gates.some(g=>g.id==="physical_iphone" && g.status==="HOLD"));
  assert.ok(manifest.gates.some(g=>g.id==="apple_sandbox_subscriptions" && g.status==="HOLD"));
  assert.ok(manifest.gates.some(g=>g.id==="source_main_reconciliation" && g.status==="PASS" && g.evidence?.endsWith("/pull/875")));
  assert.ok(manifest.gates.some(g=>g.id==="startup_passport_fixes" && g.status==="PASS" && g.evidence?.endsWith("/runs/45005943667")));
  assert.ok(manifest.gates.some(g=>g.id==="exact_head_all_ci" && g.status==="HOLD"), "Old simulator PASS must not certify a newer release head");
  assert.ok(manifest.gates.some(g=>g.id==="apple_bundle_signing" && g.status==="HOLD"));
  assert.ok(manifest.gates.some(g=>g.id==="build7_8_compatibility" && g.status==="HOLD"));
  assert.ok(manifest.gates.some(g=>g.id==="production_schema_rehearsal" && g.status==="HOLD"));
  assert.ok(manifest.gates.some(g=>g.id==="owner_mfa_signed_http" && g.status==="HOLD"));
});
