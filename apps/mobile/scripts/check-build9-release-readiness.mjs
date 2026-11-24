import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { REQUIRED_GATE_IDS, missingRequiredGateIds, nonWaivableWaivers } from "./build9-required-gates.mjs";

const mobile = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(mobile, "../..");
const snapshot = JSON.parse(readFileSync(resolve(root, "reports/build9/release/build9-gates.json"), "utf8"));
const app = JSON.parse(readFileSync(resolve(mobile, "app.json"), "utf8")).expo;
const eas = JSON.parse(readFileSync(resolve(mobile, "eas.json"), "utf8"));
const enforce = process.argv.includes("--release");
const failures = [];
const need = (ok, message) => { if (!ok) failures.push(message); };

need(snapshot.schema_version === 1 && snapshot.release === "Build 9", "Unexpected release manifest");
const gates = Array.isArray(snapshot.gates) ? snapshot.gates : [];
need(Array.isArray(snapshot.gates) && gates.length >= REQUIRED_GATE_IDS.length, "Incomplete release gate checklist");
const missing = missingRequiredGateIds(gates);
need(missing.length === 0, "Missing mandatory Build 9 release gates: " + missing.join(", "));
const forbiddenWaivers = nonWaivableWaivers(gates);
need(forbiddenWaivers.length === 0, "Cannot waive security, compatibility, Apple or owner approval gates: " + forbiddenWaivers.join(", "));
const ids = new Set();
for (const gate of gates) {
  need(typeof gate.id === "string" && !ids.has(gate.id), "Duplicate/invalid gate ID");
  ids.add(gate.id);
  need(["PASS", "HOLD", "WAIVED"].includes(gate.status), "Unknown release status for " + gate.id);
  need(typeof gate.details === "string" && gate.details.length > 10, "Missing gate explanation: " + gate.id);
  if (gate.status === "PASS" || gate.status === "WAIVED") {
    need(typeof gate.evidence === "string" && /^https:\/\//.test(gate.evidence), "Missing evidence URL: " + gate.id);
  }
  if (gate.status === "WAIVED") {
    need(/risk|unverified/i.test(gate.details), "Waiver must disclose unverified risk: " + gate.id);
  }
}
// A signed IPA only certifies the exact source SHA it was built from. Release
// notes and later code edits must not silently reuse that older signed artifact.
const signedBuildCommit = snapshot.build?.signed_ios_commit;
need(typeof signedBuildCommit === "string" && /^[a-f0-9]{40}$/i.test(signedBuildCommit), "Missing pinned signed iOS source SHA");
need(Number.isInteger(snapshot.build?.last_verified_store_build) && snapshot.build.last_verified_store_build >= 9, "Signed Build 9 app build number missing");
need(typeof snapshot.build?.signed_ios_build_id === "string" && /^[0-9a-f-]{36}$/i.test(snapshot.build.signed_ios_build_id), "Signed EAS build ID missing");
need(typeof snapshot.build?.signed_ios_archive_url === "string" && /^https:\/\/expo\.dev\/artifacts\/eas\/[^\s]+\.ipa$/.test(snapshot.build.signed_ios_archive_url), "Signed IPA evidence URL missing");
need(typeof snapshot.build?.app_store_submission_id === "string" && /^[0-9a-f-]{36}$/i.test(snapshot.build.app_store_submission_id), "App Store upload queue evidence missing");
need(app.extra?.eas?.projectId === snapshot.build.expo_project_id, "Expo project ID drift");
need(app.ios?.bundleIdentifier === snapshot.build.bundle_id, "iOS bundle ID drift");
need(app.ios?.associatedDomains?.includes("applinks:hoopcheck.online"), "Apple universal link drift");
need(app.version === snapshot.build.version, "App version differs from reviewed preflight");
need(eas.cli?.requireCommit === true && eas.cli?.appVersionSource === "remote", "EAS immutable commit/remote numbering disabled");
need(eas.build?.production?.autoIncrement === true && eas.build?.production?.environment === "production", "Production EAS build profile mismatch");
need(String(eas.submit?.production?.ios?.ascAppId ?? "") === snapshot.build.app_id, "App Store Connect app identity mismatch");
for (const path of [
  "app/dashboard.tsx", "app/messages.tsx", "app/hoopgroups.tsx",
  "app/feed-welcome.tsx", "app/leagues.tsx",
  "components/RoleHub.tsx", "components/AppOpening.tsx",
  "scripts/build9-role-chat-reconciliation.test.mjs",
  "scripts/check-ios-release-identity.cjs"
]) need(existsSync(resolve(mobile, path)), "Missing Build 9 native feature/guard: " + path);
const holds = gates.filter(g => g.status === "HOLD");
const waived = gates.filter(g => g.status === "WAIVED");
if (enforce) {
  need(holds.length === 0, holds.map(g => "Gate HOLD: " + g.id).join("; "));
  const approved = (process.env.HOOPCHECK_APPROVED_IOS_BUNDLE_ID || "").trim();
  need(Boolean(approved) && approved === app.ios.bundleIdentifier, "Apple-approved bundle ID missing or does not match");
  const commit = (process.env.BUILD9_RELEASE_COMMIT || "").trim();
  need(/^[a-f0-9]{40}$/i.test(commit) && commit === snapshot.release_commit, "Reviewed release SHA missing or mismatched");
  need(commit === signedBuildCommit, "Release commit is not the source SHA of the signed iOS IPA; rebuild and retest before submission");
}
console.log("Build 9 identity and native source:", failures.length ? "INVALID" : "VERIFIED LOCALLY");
console.log("Gates:", gates.length - holds.length - waived.length, "PASS /", waived.length, "WAIVED /", holds.length, "HOLD");
for (const gate of holds) console.log("HOLD:", gate.id, "-", gate.details);
for (const gate of waived) console.log("WAIVED (NOT PASSED):", gate.id, "-", gate.details);
console.log("This is a local snapshot, NOT real Auth, Apple, production schema or physical iPhone verification.");
if (failures.length) {
  for (const reason of failures) console.error("BUILD 9 RELEASE HOLD:", reason);
  process.exitCode = 2;
} else if (enforce) {
  console.log("Build 9 release attestations satisfied locally; independently confirm external evidence before an EAS build.");
}
