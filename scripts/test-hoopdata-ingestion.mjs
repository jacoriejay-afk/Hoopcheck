import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const code = ts.transpileModule(read("lib/hoopdata-ingestion.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { validateProviderSnapshot, validatedProviderScore, providerTipoff, scoreSnapshotFreshness } =
  await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
test("provider duplicates are rejected even when numeric and string IDs differ in representation", () => {
  assert.equal(validateProviderSnapshot([{id:1},{id:"2"}]), true);
  assert.equal(validateProviderSnapshot([{id:1},{id:"1"}]), false);
  for (const row of [null,{}, {id:0}, {id:-1}, {id:1.5}, {id:""}, {id:"001"}, {id:NaN}]) {
    assert.equal(validateProviderSnapshot([row]), false);
  }
  assert.equal(validateProviderSnapshot([]), true);
});
test("unknown, negative, fractional and nonfinite scores are never displayed as zero", () => {
  assert.equal(validatedProviderScore(0), 0);
  assert.equal(validatedProviderScore(87), 87);
  for (const value of [null, undefined, -1, 2.5, Infinity, NaN, "0"]) assert.equal(validatedProviderScore(value), null);
});
test("tip-offs use an explicit UTC instant or timezone offset only", () => {
  assert.equal(providerTipoff(1795608000, null), new Date(1795608000000).toISOString());
  assert.equal(providerTipoff(null,"2026-11-25T20:00:00+04:00"), "2026-11-25T16:00:00.000Z");
  assert.equal(providerTipoff(null,"2026-11-25T20:00:00"), null);
  assert.equal(providerTipoff(Number.MAX_SAFE_INTEGER,"invalid"), null);
  assert.equal(providerTipoff(null,"2026-11-25"), null);
});
test("snapshot freshness is delayed after 25 minutes; missing or future data is unknown", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  assert.equal(scoreSnapshotFreshness("2026-11-25T11:35:00Z",now), "fresh");
  assert.equal(scoreSnapshotFreshness("2026-11-25T11:34:59Z",now), "delayed");
  for (const stamp of [null,undefined,"invalid","2026-11-25T12:01:00Z"]) assert.equal(scoreSnapshotFreshness(stamp,now),"unknown");
});
test("ingestion rejects duplicate snapshots before writes and preserves distinct terminal states", () => {
  const route = read("app/api/cron/live-basketball/route.ts");
  assert.ok(route.indexOf("validateProviderSnapshot(payload.response)") < route.indexOf('.insert(newMappings)'));
  assert.ok(route.includes('providerStatus === "POST" || providerStatus === "SUSP" ? "postponed"'));
  assert.ok(route.includes('providerStatus === "ABD" ? "abandoned"'));
  assert.ok(route.includes("if (!startDate) continue"));
  assert.ok(route.includes('upsert(rows, { onConflict: "provider_source,provider_game_id" })'));
  assert.equal((route.match(/await fetch\(/g)||[]).length,1);
});
test("live games distinguish source freshness from UI refresh and support legacy schema", () => {
  const hub = read("app/live-games/page.tsx");
  assert.ok(hub.includes('gameFields + ",score_updated_at"'));
  assert.ok(hub.includes('result.error?.code === "42703" ? readGames(gameFields) : result'));
  assert.ok(hub.includes("Score update delayed"));
  assert.ok(hub.includes("Score freshness unavailable"));
});
