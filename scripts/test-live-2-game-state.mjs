// LIVE-2 Part A: deterministic score freshness contract.
// Run: node scripts/test-live-2-game-state.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/live-2-game-state.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(js.diagnostics?.length ?? 0, 0, "TypeScript transpilation diagnostics");
const exports = {};
vm.runInNewContext(js.outputText, { exports, Date, Number, Math });
const { hasFreshLiveScore, getGameScoreDisplay } = exports;
const now = new Date("2026-11-13T12:00:00.000Z");
const game = (status, score_source, ageMs) => ({
  status, score_source,
  score_updated_at: ageMs === null ? null : new Date(now.getTime() - ageMs).toISOString(),
});
const cases = [
  ["recent api score", game("live", "api", 60_000), true],
  ["recent fan score", game("live", "fan", 60_000), true],
  ["four minutes 59 seconds", game("live", "api", 299_999), true],
  ["five minutes exactly", game("live", "api", 300_000), false],
  ["stale score", game("live", "api", 600_000), false],
  ["future timestamp", game("live", "api", -1_000), false],
  ["missing timestamp", game("live", "api", null), false],
  ["unverified score", game("live", "none", 1_000), false],
  ["scheduled with recent score", game("scheduled", "api", 1_000), false],
  ["final with recent score", game("final", "api", 1_000), false],
];
for (const [name, value, expected] of cases) {
  assert.equal(hasFreshLiveScore(value, now), expected, name);
}
assert.equal(getGameScoreDisplay(game("live", "api", 300_000), now).label, "LAST UPDATE");
assert.equal(getGameScoreDisplay(game("live", "api", 300_000), now).minutesSinceUpdate, 5);
assert.equal(getGameScoreDisplay(game("scheduled", "none", null), now).label, "UPCOMING");
assert.equal(getGameScoreDisplay(game("final", "api", 600_000), now).label, "FINAL");
assert.equal(getGameScoreDisplay(game("live", "fan", 10_000), now).label, "LIVE");
console.log("LIVE-2 game-state: 15 assertions passed");
