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
