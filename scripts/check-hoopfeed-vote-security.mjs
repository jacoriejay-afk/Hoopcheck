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


const bookmarkStart = source.indexOf('if (kind === "bookmark")');
const bookmarkEnd = source.indexOf('if (kind === "pin")', bookmarkStart);
assert(bookmarkStart >= 0 && bookmarkEnd > bookmarkStart, "Expected bookmark endpoint block");
const bookmark = source.slice(bookmarkStart, bookmarkEnd);
assert.match(bookmark, /Authorization:\s*`Bearer \$\{token\}`/);
assert.match(bookmark, /viewerDb\.from\("feed_posts"\)/);
assert.doesNotMatch(bookmark, /db\.from\("feed_posts"\)/);
assert.match(bookmark, /post\.expires_at/);
assert.match(bookmark, /post\.status\s*!==\s*"approved"/);


const shareStart = source.indexOf('if (kind === "share")');
const shareEnd = source.indexOf('// Stage 2 post kinds:', shareStart);
assert(shareStart >= 0 && shareEnd > shareStart, "Expected share endpoint block");
const share = source.slice(shareStart, shareEnd);
assert.match(share, /Authorization:\s*`Bearer \$\{token\}`/);
assert.match(share, /viewerDb\.from\("feed_posts"\)/);
assert.doesNotMatch(share, /(?:await\s+)db\.from\("feed_posts"\)\s*\.select\(/);
assert.match(share, /source\.expires_at/);
assert.match(share, /source\.status\s*!==\s*"approved"/);
assert.doesNotMatch(share, /2100-01-01/);
assert.match(share, /const expiresAt = new Date\(source\.expires_at\)/);

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
  assert.match(policy, /case\s+when\s+jsonb_typeof\(fp\.poll_options\)\s*=\s*'array'/i, `Policy ${policyName} must guard JSON array length with CASE`);
  if (policyName !== "feed poll votes read") {
    assert.match(policy, /user_id\s*=\s*\(select auth\.uid\(\)\)/, `Policy ${policyName} missing owner check`);
  }
}
assert.match(migration, /commit;/i, "Security migration must commit transaction");

console.log("HoopFeed vote endpoint and poll-vote migration security guards passed");


assert.match(migration, /jsonb_typeof\(fp\.poll_options\)\s*=\s*'array'/);
assert.match(migration, /option_index\s*>=\s*0/);
assert.match(migration, /option_index\s*<\s*jsonb_array_length\(fp\.poll_options\)/);

const bookmarkMigration = readFileSync(new URL("../supabase/migrations/20261111000200_secure_feed_bookmarks.sql", import.meta.url), "utf8");
assert.match(bookmarkMigration, /drop policy if exists "feed bookmarks insert own"/);
assert.match(bookmarkMigration, /for insert to authenticated/);
assert.match(bookmarkMigration, /auth\.uid\(\)/);
assert.match(bookmarkMigration, /can_view_player_feed_post/);
assert.match(bookmarkMigration, /expires_at\s*>\s*now\(\)/);
assert.match(bookmarkMigration, /status\s*=\s*'approved'/);
