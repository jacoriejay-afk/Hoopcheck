import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

async function load(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}

const { getGameChatState, chatOpeningTime } = await load("../lib/livechat-lifecycle.ts");
const { groupLiveChatGames } = await load("../lib/livechat-groups.ts");
const tip = "2026-11-12T18:00:00.000Z";
const fixture = { status: "scheduled", scheduled_at: tip, started_at: null, ends_at: null };
const at = (iso) => new Date(iso);
assert.equal(getGameChatState(fixture, at("2026-11-12T16:59:59.999Z")), "upcoming");
assert.equal(getGameChatState(fixture, at("2026-11-12T17:00:00.000Z")), "open");
assert.equal(chatOpeningTime(fixture).toISOString(), "2026-11-12T17:00:00.000Z");
assert.equal(getGameChatState(fixture, at("2026-11-12T21:59:59.999Z")), "open");
assert.equal(getGameChatState(fixture, at("2026-11-12T22:00:00.000Z")), "read-only");
assert.equal(getGameChatState({ ...fixture, status: "live" }, at("2026-11-12T22:00:00.000Z")), "open");
const final = { ...fixture, status: "final", ends_at: "2026-11-12T20:00:00.000Z" };
assert.equal(getGameChatState(final, at("2026-11-12T21:59:59.999Z")), "open");
assert.equal(getGameChatState(final, at("2026-11-12T22:00:00.000Z")), "read-only");
assert.equal(getGameChatState({ ...final, ends_at: null }, at("2026-11-12T20:01:00.000Z")), "read-only");
assert.equal(getGameChatState({ ...fixture, status: "postponed" }, at("2026-11-12T18:00:00.000Z")), "read-only");

const games = [
  { id: "az-upcoming", country: "Azerbaijan", league_name: "ABL", status: "scheduled", scheduled_at: tip },
  { id: "de-live", country: "Germany", league_name: "BBL", status: "live", scheduled_at: tip },
  { id: "az-live", country: "Azerbaijan", league_name: "ABL", status: "live", scheduled_at: tip },
  { id: "de-upcoming", country: "Germany", league_name: "BBL", status: "scheduled", scheduled_at: tip },
];
const groups = groupLiveChatGames(games, ["Germany", "Azerbaijan"]);
assert.deepEqual(groups.map(group => group.name), ["Germany", "Azerbaijan"]);
assert.deepEqual(groups[0].leagues[0].games.map(game => game.id), ["de-live", "de-upcoming"]);
assert.deepEqual(groups[1].leagues[0].games.map(game => game.id), ["az-live", "az-upcoming"]);
assert.deepEqual(groupLiveChatGames(games, [], "azer").map(group => group.name), ["Azerbaijan"]);
assert.deepEqual(groupLiveChatGames(games, [], "BBL").map(group => group.name), ["Germany"]);
assert.equal(new Set(groups.flatMap(group => group.leagues.flatMap(league => league.games.map(game => game.id)))).size, 4);
console.log("LIVECHAT-1 lifecycle and country/league grouping tests passed.");
