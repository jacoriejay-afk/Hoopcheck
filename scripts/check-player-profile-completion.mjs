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

const marketSource=await readFile(new URL("../lib/marketplace-discovery.ts",import.meta.url),"utf8");
const marketCode=ts.transpileModule(marketSource,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {availablePlayerMatches,filterProfessionalShowcases}=await import("data:text/javascript;base64,"+Buffer.from(marketCode).toString("base64"));
const rows=[{id:"a",free_agent:true},{id:"b",free_agent:false},{id:"c",free_agent:null},{id:"d",free_agent:"true"}];
assert.deepEqual(availablePlayerMatches(rows,true).map(row=>row.id),["a"]);
assert.equal(availablePlayerMatches(rows,false).length,4);
const showcases=[{id:"a",account_type:"agent",professionally_reviewed:false,identity_checked:true,agency_name:"Example Sports"},{id:"b",account_type:"scout",professionally_reviewed:true,identity_checked:false,agency_name:null}];
assert.deepEqual(filterProfessionalShowcases(showcases,"all"," example sports ").map(row=>row.id),["a"]);
assert.deepEqual(filterProfessionalShowcases(showcases,"identity","").map(row=>row.id),["a"]);
assert.deepEqual(filterProfessionalShowcases(showcases,"verified","").map(row=>row.id),["b"]);
assert.deepEqual(filterProfessionalShowcases(showcases,"scout","example"),[]);
const playerDirectory=await readFile(new URL("../app/players/page.tsx",import.meta.url),"utf8");
assert.match(playerDirectory,/supabase\.rpc\("search_public_players_by_username"/);
assert.match(playerDirectory,/if \(!username\)/);
assert.match(playerDirectory,/availablePlayerMatches\(players, onlyAvailable\)/);
assert.match(playerDirectory,/self-reported, not a verified recruiting or contract status/);
assert.match(playerDirectory,/!searchError && players.length > 0/,"pagination must retain the unfiltered search page");
const professionalDirectory=await readFile(new URL("../app/agents/page.tsx",import.meta.url),"utf8");
assert.match(professionalDirectory,/filterProfessionalShowcases\(people,scope,q\)/);
assert.match(professionalDirectory,/up to 200 recent showcases/);
assert.match(professionalDirectory,/identity check confirms a person's identity, not agency authorization/);
console.log("PASS: existing consent-aware marketplace discovery, bounded results and independent review labels.");

assert.match(playerDirectory,/\}, \[query, country, page, retryCount, roleReady\]\);\s+const visiblePlayers = availablePlayerMatches\(players, onlyAvailable\);\s+if \(!roleReady\) return <main/, "filtered results must be in component render scope, outside the effect");
