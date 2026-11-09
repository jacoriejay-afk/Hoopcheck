import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261107100000_fol1_fan_career_tracking.sql", "utf8");
const protectedFiles = [
  "components/HoopFeedShared.tsx",
  "app/api/hoopfeed/moderate/route.ts",
  "supabase/migrations/20261022170000_fan_hoopfeed_separate_surface.sql",
  "supabase/migrations/20261022173000_tighten_fan_feed_interaction_policies.sql",
];

assert.match(migration, /create table if not exists public\.fan_player_career_follows/i);
assert.match(migration, /target_type in\s*\([^)]*'player'/is);
assert.match(migration, /p\.account_type='fan'/i);
assert.match(migration, /p\.account_type='player'/i);
assert.match(migration, /notify_fan_player_team_change/i);
assert.match(migration, /delete on public\.fan_player_career_follows/i);

for (const path of protectedFiles) {
  const source = fs.readFileSync(path, "utf8");
  assert.doesNotMatch(source, /fan_player_career_follows/i,
    `Career-follow relationship leaked into HoopFeed source/policy: ${path}`);
}

console.log("FOL-1 static boundary checks passed: career follows are separate from HoopFeed sources and policies.");
