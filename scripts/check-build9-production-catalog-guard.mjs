import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Offline-only invariants for the pre-migration production catalog guard.
// Does not connect to Supabase, attest that production is safe, or run SQL.
const sql=readFileSync(new URL("../reports/build9/integration/production-catalog-guard.sql",import.meta.url),"utf8");
const statements=sql.split("\n").filter(line=>!line.trim().startsWith("--")).join("\n");
assert.match(statements,/^BEGIN TRANSACTION READ ONLY;/m);
assert.match(statements,/^ROLLBACK;\s*$/m);
assert.equal((statements.match(/\bBEGIN TRANSACTION READ ONLY;/g)||[]).length,1);
assert.equal((statements.match(/^ROLLBACK;$/gm)||[]).length,1);
assert.match(statements,/Different installed production contract/);
assert.match(statements,/Production function drift detected/);
assert.match(statements,/Production advanced beyond the captured Build 9 baseline/);
assert.match(statements,/Raw country access has changed/);
assert.match(statements,/profile.*relrowsecurity|relrowsecurity.*profiles/);
for(const [name,fingerprint] of [
  ["get_public_player_profile(uuid)","5d7ea9682e0f549b359888c019a657bb"],
  ["search_public_players(text,text,text,boolean,integer)","378505e5bc40299370a991d17058a095"],
  ["search_public_players_page(text,text,text,boolean,integer,integer)","0b35b8188a6a26fb457b6cca1295a93e"],
  ["get_public_follow_list(text,text,uuid,uuid)","557d85a6abf873e47ffc1f4ae283debd"],
]){
  assert.ok(statements.includes("public."+name),"production signature missing for "+name);
  assert.ok(statements.includes(fingerprint),"source hash missing for "+name);
}
for(const forbidden of [/^\s*(?:CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE)\b/im,
/^\s*COMMIT;/im,/\bpg_(?:read_file|ls_dir|execute_server_program)\b/i]){
  assert.doesNotMatch(statements,forbidden,"guard must be read-only");
}
console.log("PASS: production catalog guard has exact fingerprints, drift stops, and read-only boundaries (offline only)");
