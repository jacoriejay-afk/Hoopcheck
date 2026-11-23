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
  assert.ok(manifest.gates.some(g=>g.id==="apple_bundle_signing" && g.status==="PASS"
    && g.evidence === manifest.build.signed_ios_archive_url));
  assert.ok(manifest.gates.some(g=>g.id==="build7_8_compatibility" && g.status==="HOLD"));
  assert.ok(manifest.gates.some(g=>g.id==="production_schema_rehearsal"
    && g.status==="WAIVED" && /unverified/i.test(g.details) && /^https:\/\//.test(g.evidence)),
    "Explicit schema waiver must disclose residual risk and link owner's decision");
  assert.ok(manifest.gates.some(g=>g.id==="owner_mfa_signed_http" && g.status==="HOLD"));
});

test("Build 9 keeps signed archive evidence separate from public release clearance", () => {
  assert.equal(manifest.build.last_verified_store_build, 9);
  assert.equal(manifest.build.signed_ios_commit, "cf29f4190e42dcbcd86ddbcac4547415fe0227f1");
  assert.match(manifest.build.signed_ios_build_id, /^[0-9a-f-]{36}$/i);
  assert.match(manifest.build.signed_ios_archive_url, /^https:\/\/expo\.dev\/artifacts\/eas\/.+\.ipa$/);
  assert.match(manifest.build.app_store_submission_id, /^[0-9a-f-]{36}$/i);
  assert.equal(manifest.release_commit, null, "Signing a binary does not approve production release");
  assert.equal(manifest.gates.find(g => g.id === "exact_head_all_ci").status, "HOLD", "Changing the release manifest requires fresh exact-head CI");
});

test("Build 9 forbids reusing a signed IPA for a different release SHA", () => {
  const x = run(["--release"], {
    HOOPCHECK_APPROVED_IOS_BUNDLE_ID: manifest.build.bundle_id,
    BUILD9_RELEASE_COMMIT: "a".repeat(40),
  });
  assert.equal(x.status, 2);
  assert.match(x.stderr, /Release commit is not the source SHA of the signed iOS IPA/);
});
