import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../app/players/[id].tsx", import.meta.url), "utf8");
test("report action blocks self-report and synchronous duplicate taps", () => {
  assert.match(source, /if \(reportInFlight\.current \|\| reportSubmitting \|\| !player \|\| player\.id !== id \|\| player\.id === viewerId\) return/);
  assert.match(source, /reportInFlight\.current = true;\s*setReportSubmitting\(true\)/);
  assert.match(source, /finally \{\s*reportInFlight\.current = false;\s*setReportSubmitting\(false\)/);
  assert.match(source, /player\.id !== viewerId \? <GlassCard style=\{styles\.reportCard\}>/);
});
test("report confirmation requires an affirmative server result", () => {
  assert.match(source, /if \(!response\.ok \|\| result\.ok !== true\)/);
  assert.match(source, /editable=\{!reportSubmitting\}/);
  assert.match(source, /verified\.data\.user\?\.id !== viewerId/);
});

const api = readFileSync(new URL("../../../app/api/profile-reports/route.ts", import.meta.url), "utf8");
test("report validation agrees with the existing database length constraint", () => {
  assert.match(api, /const reasonLength = Array\.from\(reason\)\.length/);
  assert.match(api, /reasonLength < 3 \|\| reasonLength > 500/);
  assert.match(source, /Array\.from\(reason\)\.length < 3/);
  assert.match(source, /disabled=\{reportSubmitting \|\| Array\.from\(reportReason\.trim\(\)\)\.length < 3\}/);
});
test("server rate limit is surfaced without logging report details", () => {
  assert.match(api, /error\.code === "P0001" && error\.message === "Report submission rate limit reached"/);
  assert.match(api, /status: 429/);
  assert.match(api, /console\.error\("Profile report insert failed:", \{ code: error\.code \}\)/);
  assert.doesNotMatch(api, /console\.error\("Profile report insert failed:", error\)/);
});
