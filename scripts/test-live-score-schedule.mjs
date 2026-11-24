import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/live-score-schedule.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
new Function("exports", compiled)(exports);
const { selectFixtureSyncDay } = exports;
const bakuDate = (day, hour, minute = 7) =>
  new Date(`2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+04:00`);

test("96 daily GitHub schedule slots use exactly eight off-today calls and 88 live-score updates", () => {
  const distribution = new Map();
  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [7, 22, 37, 52]) {
      const { date, dayOffset } = selectFixtureSyncDay(bakuDate(24, hour, minute));
      assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
      distribution.set(dayOffset, (distribution.get(dayOffset) || 0) + 1);
    }
  }
  assert.equal(distribution.get(0), 88, "Keep most calls for today's live scores");
  assert.equal(distribution.get(-1), 1, "Revisit yesterday's delayed finals");
  for (let offset = 1; offset <= 7; offset++) {
    assert.equal(distribution.get(offset), 1, `Coverage for future day +${offset}`);
  }
  assert.equal([...distribution.values()].reduce((n, x) => n + x, 0), 96);
});

test("fixture date rotates correctly through month and year boundaries in Asia/Baku", () => {
  assert.deepEqual(selectFixtureSyncDay(bakuDate(24, 0, 7)), { date: "2026-11-25", dayOffset: 1 });
  assert.deepEqual(selectFixtureSyncDay(bakuDate(24, 18, 7)), { date: "2026-12-01", dayOffset: 7 });
  assert.deepEqual(selectFixtureSyncDay(bakuDate(24, 21, 7)), { date: "2026-11-23", dayOffset: -1 });
  assert.deepEqual(selectFixtureSyncDay(bakuDate(24, 21, 22)), { date: "2026-11-24", dayOffset: 0 });
  assert.deepEqual(selectFixtureSyncDay(new Date("2026-12-31T20:07:00Z")), { date: "2027-01-02", dayOffset: 1 });
  assert.deepEqual(selectFixtureSyncDay(new Date("2028-02-28T20:07:00Z")), { date: "2028-03-01", dayOffset: 1 });
  assert.throws(() => selectFixtureSyncDay(new Date(NaN)), /Invalid sync time/);
});

test("cron uses one existing authenticated, bounded provider request per invocation", () => {
  const handler = readFileSync(new URL("../app/api/cron/live-basketball/route.ts", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../.github/workflows/live-basketball-score-sync.yml", import.meta.url), "utf8");
  assert.match(handler, /selectFixtureSyncDay\(\)/);
  assert.match(handler, /const \{ date: fixtureDate, dayOffset \} = selectFixtureSyncDay\(\)/);
  assert.match(handler, /const supplied = request\.headers\.get\("authorization"\)/);
  assert.match(handler, /supplied !== `Bearer \$\{secret\}`/);
  assert.match(handler, /AbortSignal\.timeout\(12000\)/);
  assert.match(handler, /cache: "no-store"/);
  assert.equal((handler.match(/await fetch\(/g) || []).length, 1, "Never expand provider calls per invocation");
  assert.match(handler, /upsert\(rows, \{ onConflict: "provider_source,provider_game_id" \}\)/);
  assert.match(workflow, /cron: "7,22,37,52 \* \* \* \*"/);
  assert.match(workflow, /LIVE_SCORES_CRON_SECRET/);
  assert.match(workflow, /timeout-minutes: 1/);
});

test("provider snapshots record actual receipt times and scan the full mapped team directory", () => {
  const source = readFileSync(new URL("../app/api/cron/live-basketball/route.ts", import.meta.url), "utf8");
  assert.match(source,/score_updated_at: receivedAt/);
  assert.match(source,/const receivedAt = new Date\(\).toISOString\(\)/);
  assert.equal((source.match(/\.range\(offset,offset\+499\)/g)||[]).length,2);
  assert.match(source,/Object.keys\(payload.errors\).length > 0/);
  assert.match(source,/if \(insertMappingsError\) throw insertMappingsError/);
});
