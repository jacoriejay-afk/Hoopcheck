import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20261114095000_reels_phase_a_default_deny.sql", import.meta.url), "utf8");
assert.doesNotMatch(sql, /\\\\n/, "migration must not contain literal escaped newline sequences");
const tables = ["reels", "reel_checks", "reel_bookmarks", "reel_comments"];
for (const table of tables) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\s*\\(`, "i"), `${table}: table created`);
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security\\s*;`, "i"), `${table}: RLS enabled`);
  assert.match(sql, new RegExp(`revoke all on table public\\.${table} from anon, authenticated\\s*;`, "i"), `${table}: client privileges revoked`);
}
assert.doesNotMatch(sql, /create\s+policy|grant\s+(select|insert|update|delete|all)\s+on/i, "Phase A must not grant client access");
assert.match(sql, /video_bucket text not null default 'hoopfeed-private-videos'/);
assert.match(sql, /video_object_path text not null unique/);
assert.match(sql, /constraint reels_owner_path check/);
assert.match(sql, /status text not null default 'under_review'/);
assert.match(sql, /constraint reels_single_tag check/);
console.log("REELS-1 Phase A default-deny migration invariants passed");
