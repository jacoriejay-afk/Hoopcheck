// Static release guard for HoopFeed authorization and expiry regressions.
// Run with: node scripts/check-hoopfeed-security.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const route = readFileSync("app/api/hoopfeed/moderate/route.ts", "utf8");
const poll = readFileSync("app/api/hoopfeed/poll-results/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261110000700_hoopfeed_poll_vote_private_read.sql", "utf8");
const feed = readFileSync("app/feed/page.tsx", "utf8");

const checks = [
  ["new posts expire after 24 hours", route.includes('expires_at:new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()')],
  ["reshare expiration capped at 24 hours", route.includes('Math.min(new Date(source.expires_at).getTime(), sharedAt.getTime() + 24 * 60 * 60 * 1000)')],
  ["vote authorization uses viewer RLS", route.includes('canReadPostAsViewer(postId, token)')],
  ["cross-author copying blocked", route.includes('source.author_id !== user.id')],
  ["video object existence checked", route.includes('Video upload not found. Please upload again.')],
  ["video MIME metadata verified", route.includes('uploaded.metadata?.mimetype') && route.includes('storedType !== videoType')],
  ["video extension validated", route.includes('videoExtensionMatchesType[videoType]?.test(videoPath)')],
  ["video requires moderated caption", route.includes('if (videoPath && !text)')],
  ["poll totals require viewer RLS", poll.includes('viewer.from("feed_posts")')],
  ["empty poll requests authenticate first", poll.indexOf('if (!uniqueIds.length)') > poll.indexOf('if (authError || !authData.user)')],
  ["empty poll responses are not cached", poll.includes('if (!uniqueIds.length) return NextResponse.json({ results: {} }, { headers: { "Cache-Control": "private, no-store" } })')],
  ["poll totals never return raw voter rows", !poll.includes('NextResponse.json({ votes')],
  ["invalid stored votes fail closed", poll.includes('Invalid persisted votes must not silently disappear from totals.')],
  ["malformed poll options fail closed", poll.includes('A visible poll with malformed options is a data-integrity failure')],
  ["poll vote SELECT limited to own user", /create policy "feed poll votes read"[\s\S]*?using \(user_id = \(select auth\.uid\(\)\)\)/.test(migration)],
  ["bookmark insert requires approved post", /create policy "feed bookmarks insert own"[\s\S]*?p\.status = 'approved'/.test(migration)],
  ["feed disables voting if results unavailable", feed.includes('pollResultsUnavailable')],
];
for (const [name, passed] of checks) {
  assert.ok(passed, `HoopFeed security regression: ${name}`);
  console.log(`PASS ${name}`);
}
console.log(`Passed ${checks.length} HoopFeed static security guards. These do not replace authenticated integration tests.`);
