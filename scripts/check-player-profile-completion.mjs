import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/player-profile-completion.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { getPlayerProfileCompletion, PLAYER_PROFILE_COMPLETION_FIELDS } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

const player = {
  account_type: "player", avatar_url: "photo", position: "PG", current_team: "Team",
  current_country: "Country", favorite_leagues: null, height: "193 cm", bio: "Bio", hometown: "City",
};
assert.equal(PLAYER_PROFILE_COMPLETION_FIELDS.length, 7);
assert.equal(getPlayerProfileCompletion(player).percentage, 100);
for (const [field, key] of Object.entries({ avatar_url: "photo", position: "position", current_team: "current_team", height: "height", bio: "bio", hometown: "location" })) {
  const result = getPlayerProfileCompletion({ ...player, [field]: "  " });
  assert.equal(result.completed, 6);
  assert.deepEqual(result.missing, [key]);
}
assert.deepEqual(getPlayerProfileCompletion({ ...player, current_country: null, favorite_leagues: null }).missing, ["league_country"]);
assert.equal(getPlayerProfileCompletion({ ...player, current_country: null, favorite_leagues: "League" }).percentage, 100);
assert.equal(getPlayerProfileCompletion({ ...player, current_team: null, free_agent: true }).percentage, 100);
assert.deepEqual(getPlayerProfileCompletion({ ...player, current_team: null, free_agent: false }).missing, ["current_team"]);
assert.equal(getPlayerProfileCompletion({ ...player, account_type: "fan" }).percentage, 0);
assert.equal(getPlayerProfileCompletion(null).percentage, 0);
console.log("Player profile completion checks passed.");
