// Static checks complement authenticated integration tests and the SQL policy smoke test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const source = read("app/api/hoopfeed/moderate/route.ts");

function action(kind, endMarker) {
  const start = source.indexOf(`if (kind === "${kind}")`);
  const end = source.indexOf(endMarker, start);
  assert(start >= 0 && end > start, `Expected ${kind} action`);
  return source.slice(start, end);
}

assert.match(source, /const viewerDb = [\s\S]*?createClient\(supabaseUrl, publishableKey, \{\s*global: \{ headers: \{ Authorization: "Bearer " \+ token \}/);
const entitlementGuard = source.indexOf("if (!entitlements.canWriteHoopFeed)");
assert(entitlementGuard >= 0 && entitlementGuard < source.indexOf('if (kind === "vote")'));

const vote = action("vote", 'if (kind === "bookmark")');
assert.match(vote, /viewerDb\.from\("feed_posts"\)/);
assert.match(vote, /viewerDb\.from\("feed_poll_votes"\)\.upsert\(\{ post_id: postId, user_id: user\.id, option_index: optionIndex \}/);
assert.doesNotMatch(vote, /db\.from\(/);
assert.match(vote, /poll\.status !== "approved"/);
assert.match(vote, /poll\.post_kind !== "poll"/);
assert.match(vote, /poll\.expires_at/);
assert.match(vote, /optionIndex >= options\.length/);

const bookmark = action("bookmark", 'if (kind === "pin")');
assert.match(bookmark, /viewerDb\.from\("feed_posts"\)/);
assert.match(bookmark, /viewerDb\.from\("feed_post_bookmarks"\)\.upsert\(\{ post_id: postId, user_id: user\.id \}/);
assert.match(bookmark, /viewerDb\.from\("feed_post_bookmarks"\)\.delete\(\).*\.eq\("user_id", user\.id\)/);
assert.doesNotMatch(bookmark, /db\.from\(/);
assert.match(bookmark, /post\.status !== "approved"/);
assert.match(bookmark, /post\.expires_at/);

const share = action("share", "// Stage 2 post kinds:");
assert.match(share, /viewerDb\.from\("feed_posts"\)\s*\.select\(/);
assert.doesNotMatch(share, /db\.from\("feed_posts"\)\s*\.select\(/);
assert.match(share, /source\.status !== "approved"/);
assert.match(share, /source\.expires_at/);
assert.match(share, /shared_post_id: source\.id/);

const migration = read("supabase/migrations/20261114000100_secure_poll_votes_unified_visibility.sql");
for (const name of ["read", "insert own", "update own"]) {
  const policy = migration.split(`create policy "feed poll votes ${name}"`)[1]?.split(/create policy|commit;/)[0];
  assert(policy, `Missing policy ${name}`);
  assert.match(policy, /from public\.feed_posts fp/);
  assert.match(policy, /fp\.id = feed_poll_votes\.post_id/);
  assert.match(policy, /fp\.status = 'approved'/);
  assert.match(policy, /fp\.post_kind = 'poll'/);
  assert.match(policy, /fp\.expires_at > now\(\)/);
  assert.match(policy, /case when jsonb_typeof\(fp\.poll_options\) = 'array'/);
  assert.match(policy, /option_index >= 0/);
  assert.match(policy, /option_index < jsonb_array_length\(fp\.poll_options\)/);
  if (name !== "read") assert.match(policy, /user_id = \(select auth\.uid\(\)\)/);
}

const bookmarkMigration = read("supabase/migrations/20261111000200_secure_feed_bookmarks.sql");
assert.match(bookmarkMigration, /for insert to authenticated/);
assert.match(bookmarkMigration, /user_id = \(select auth\.uid\(\)\)/);
assert.match(bookmarkMigration, /fp\.id = feed_post_bookmarks\.post_id/);
assert.match(bookmarkMigration, /fp\.status = 'approved'/);

console.log("HoopFeed vote, bookmark, and share security guards passed");
