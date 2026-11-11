// Security regression guard: vote endpoint must authorize with caller-scoped RLS.
// Static checks complement, but do not replace, authenticated integration tests.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../app/api/hoopfeed/moderate/route.ts", import.meta.url), "utf8");
const start = source.indexOf('if (kind === "vote")');
const end = source.indexOf('if (kind === "bookmark")', start);
assert(start >= 0 && end > start, "Expected vote endpoint block");
const vote = source.slice(start, end);
assert.match(vote, /getHoopCheckEntitlements|canWriteHoopFeed|const viewerDb/);
// Caller-scoped client must perform the post lookup; service-role lookup is unsafe.
assert.match(vote, /global:\s*\{\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{token\}`/);
assert.match(vote, /viewerDb\s*\.from\("feed_posts"\)/);
assert.doesNotMatch(vote, /db\.from\("feed_posts"\)/);
assert.match(vote, /poll\.expires_at/);
assert.match(vote, /poll\.status\s*!==\s*"approved"/);
assert.match(vote, /poll\.post_kind\s*!==\s*"poll"/);
assert.match(vote, /optionIndex\s*>=\s*options\.length/);

const migration = readFileSync(new URL("../supabase/migrations/20261111000100_secure_feed_poll_votes.sql", import.meta.url), "utf8");
for (const [policyName, nextPolicy] of [
  ["feed poll votes read", "feed poll votes insert own"],
  ["feed poll votes insert own", "feed poll votes update own"],
  ["feed poll votes update own", null],
]) {
  const start = migration.indexOf(`create policy "${policyName}"`);
  assert(start >= 0, `Missing policy: ${policyName}`);
  const end = nextPolicy ? migration.indexOf(`drop policy if exists "${nextPolicy}"`, start) : migration.indexOf("-- Preserve existing own-vote DELETE", start);
  assert(end > start, `Missing policy boundary: ${policyName}`);
  const policy = migration.slice(start, end);
  for (const required of ["fp.status = 'approved'", "fp.post_kind = 'poll'", "fp.expires_at > now()", "can_view_player_feed_post(fp.author_id)"]) {
    assert(policy.includes(required), `Policy ${policyName} missing ${required}`);
  }
  if (policyName !== "feed poll votes read") {
    assert.match(policy, /user_id\s*=\s*\(select auth\.uid\(\)\)/, `Policy ${policyName} missing owner check`);
  }
}
assert.match(migration, /commit;/i, "Security migration must commit transaction");

console.log("HoopFeed vote endpoint and poll-vote migration security guards passed");
