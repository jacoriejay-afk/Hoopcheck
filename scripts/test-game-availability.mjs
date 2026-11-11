import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/game-availability.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getGameAvailability } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const now = new Date("2026-11-11T12:00:00Z");
const at = (minutes) => new Date(now.getTime() + minutes * 60000).toISOString();
const cases = [
  ["61 minutes before tip", {status:"scheduled",scheduledAt:at(61)}, false],
  ["60 minutes before tip", {status:"scheduled",scheduledAt:at(60)}, true],
  ["one minute before tip", {status:"scheduled",scheduledAt:at(1)}, true],
  ["postgame 119 minutes", {status:"final",scheduledAt:at(-240),endsAt:at(-119)}, true],
  ["postgame 120 minutes", {status:"final",scheduledAt:at(-240),endsAt:at(-120)}, false],
  ["final without tip", {status:"final",scheduledAt:null,endsAt:at(-30)}, true],
  ["final with tip but future confirmed end", {status:"final",scheduledAt:at(-90),endsAt:at(10)}, false],
  ["final without tip but future confirmed end", {status:"final",scheduledAt:null,endsAt:at(10)}, false],
  ["final at exact confirmed end", {status:"final",scheduledAt:at(-90),endsAt:at(0)}, true],
  ["final without end", {status:"final",scheduledAt:at(-240)}, false],
  ["cancelled", {status:"cancelled",scheduledAt:at(0)}, false],
  ["postponed", {status:"postponed",scheduledAt:at(0)}, false],
  ["live without timestamps", {status:"live",scheduledAt:null}, true],
  ["live without tip, expired end", {status:"live",scheduledAt:null,endsAt:at(-121)}, false],
  ["live without tip, recent end", {status:"live",scheduledAt:null,endsAt:at(-119)}, true],
  ["scheduled after fallback window", {status:"scheduled",scheduledAt:at(-241)}, false],
];
for (const [label, input, expected] of cases) {
  const result = getGameAvailability({...input,now});
  assert.equal(result.chatOpen,expected,label);
}
const migration = readFileSync(new URL("../supabase/migrations/20261111200000_live_chat_room_lifecycle.sql",import.meta.url),"utf8");
assert.match(migration,/interval '60 minutes'/);
assert.match(migration,/interval '2 hours'/);
assert.match(migration,/revoke all on function public\.fan_live_chat_room_open\(uuid\) from public, anon/);
assert.ok(migration.includes('create policy "eligible members read game presence"') && migration.includes("public.fan_live_chat_room_open(game_id)"));
console.log(`Passed ${cases.length} game lifecycle cases and migration guard assertions.`);
