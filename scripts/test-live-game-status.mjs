import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("lib/live-game-status.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getLiveGameStatusPresentation: present } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

const now = new Date("2026-11-22T12:00:00Z");
const active = { status: "live", period_label: "Quarter 1", started_at: "2026-11-22T11:00:00Z", scheduled_at: "2026-11-22T11:00:00Z", ends_at: null };
assert.deepEqual(present(active, now), {
  label: "LIVE", isVerifiedLive: true, isVerifiedFinal: false, isUnverified: false, showPeriod: true,
}, "Provider live Q1 must remain live");
for (const period_label of ["Quarter 1", "Q1", "Quarter 3", "Halftime", "Break Time", "Overtime"]) {
  const result = present({ ...active, status: "final", period_label }, now);
  assert.equal(result.label, "RESULT PENDING", "A terminal status with " + period_label + " cannot be a confirmed final");
  assert.equal(result.isVerifiedFinal, false);
  assert.equal(result.isVerifiedLive, false);
  assert.equal(result.showPeriod, false);
}
assert.equal(present({ ...active, status: "final", period_label: null }, now).label, "FINAL",
  "Real provider final may be displayed");
assert.equal(present({ ...active, started_at: "2026-11-22T06:00:00Z" }, now).label, "UPDATE DELAYED",
  "Overdue live rows must not be silently finalized or marked as live");
assert.equal(present({ ...active, status: "scheduled", period_label: null }, now).label, "UPCOMING");

const sync = read("app/api/cron/live-basketball/route.ts");
assert.ok(sync.includes('finalStatuses.has(providerStatus) ? "final"'), "Provider must explicitly confirm finals");
assert.doesNotMatch(sync, /update\(\{\s*status:\s*["']final["']\s*\}\)/, "Never infer final from elapsed time");
assert.doesNotMatch(sync, /staleQuery/, "Do not restore the time-based forced final");
assert.ok(sync.includes('period_label: liveStatuses.has(providerStatus)'), "Clear stale period text after genuine finals");

const hub = read("app/live-games/page.tsx");
const chat = read("app/fan-live/page.tsx");
assert.match(hub, /presentation\.isVerifiedLive/, "LIVE listing must use confirmed provider state");
assert.match(hub, /presentation\.isUnverified/, "Hub needs an honest unverified state");
assert.match(chat, /selectedStatus\?\.isUnverified/, "Game chat needs an honest unverified state");
assert.match(chat, /status\.showPeriod\?game\.period_label/, "Room picker must not show Q1 beside FINAL");
console.log("PASS: Live quarter, stale final, delayed score and room labels remain consistent.");
