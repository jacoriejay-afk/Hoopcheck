import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/hoopfeed/private-media/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261110140000_hoopfeed_private_storage_staging.sql", "utf8");
const moderation = readFileSync("app/api/hoopfeed/moderate/route.ts", "utf8");
const fan = readFileSync("app/api/fan-feed/moderate/route.ts", "utf8");

test("signed media requires a bearer token and verified user", () => {
  assert.match(route, /auth\.getUser\(bearer\)/);
  assert.match(route, /if \(!bearer\) return deny\(401\)/);
});
test("signed media is author-only and bound to an approved unexpired post and stored reference", () => {
  assert.match(route, /ref\.ownerId !== auth\.user\.id/);
  assert.match(route, /\.eq\("author_id", auth\.user\.id\)/);
  assert.match(route, /post\.status !== "approved"/);
  assert.match(route, /Date\.parse\(post\.expires_at\) <= Date\.now\(\)/);
  assert.match(route, /references\.includes\(input\.ref\)/);
  assert.match(route, /createSignedUrl\(ref\.path, 60\)/);
});
test("new private buckets do not change shared public fan-feed buckets", () => {
  assert.match(migration, /'hoopfeed-private-images'/);
  assert.match(migration, /'hoopfeed-private-videos'/);
  assert.match(migration, /false, 8388608/);
  assert.match(migration, /false, 52428800/);
  assert.doesNotMatch(migration, /values\s*\('feed-images'/i);
  assert.match(moderation, /storage\.from\("feed-images"\)/);
  assert.match(fan, /storage\.from\("feed-images"\)/);
});
