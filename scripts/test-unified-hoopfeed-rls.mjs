// Static security regression checks. Run: node scripts/test-unified-hoopfeed-rls.mjs
// These do NOT replace authenticated database integration tests.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const sql = readFileSync("supabase/migrations/20261111193500_unified_hoopfeed_check_rls.sql", "utf8");
const required = [
  /create or replace function public\.can_view_player_feed_post/i,
  /language sql stable/i,
  /set search_path = ''/i,
  /fr\.follower_id = viewer\.id/i,
  /fr\.target_id = p_author_id/i,
  /fr\.target_type = author\.account_type/i,
  /sub\.plan in \('pro','premium'\)/i,
  /sub\.status in \('active','trialing'\)/i,
  /sub\.current_period_end is null or sub\.current_period_end > now\(\)/i,
  /user_id = \(select auth\.uid\(\)\)/i,
  /fp\.status = 'approved'/i,
  /fp\.expires_at > now\(\)/i,
  /public\.can_view_player_feed_post\(fp\.author_id\)/i,
  /for insert to authenticated/i,
];
for (const check of required) assert.match(sql, check, `Missing safeguard: ${check}`);
assert.doesNotMatch(sql, /^\s*security definer\b/im, "Do not bypass RLS");
assert.doesNotMatch(sql, /to public\b/i, "No public check inserts");
assert.doesNotMatch(sql, /disable row level security/i, "Do not disable RLS");
console.log("Unified HoopFeed RLS static safeguards passed (not database integration tests).");

const commentSql = readFileSync("supabase/migrations/20261113233000_restore_hoopfeed_comment_insert_rls.sql", "utf8");
for (const check of [
  /create policy "unified hoopfeed comments insert"/i,
  /on public\.feed_post_comments/i,
  /for insert to authenticated/i,
  /author_id = \(select auth\.uid\(\)\)/i,
  /length\(btrim\(body\)\) between 1 and 2000/i,
  /from public\.feed_posts fp/i,
  /fp\.id = feed_post_comments\.post_id/i,
  /fp\.status = 'approved'/i,
  /fp\.expires_at is null or fp\.expires_at > now\(\)/i,
]) assert.match(commentSql, check, `Missing HoopFeed comment safeguard: ${check}`);
assert.doesNotMatch(commentSql, /disable row level security|security definer/i, "Comment inserts must retain RLS");
const commentRoute = readFileSync("app/api/hoopfeed/moderate/route.ts", "utf8");
assert.match(commentRoute, /if \(kind === "comment"\)/);
assert.match(commentRoute, /await canInteractWithPost\(actionPostId\)/);
assert.match(commentRoute, /const decision = await moderate\(text, null\)/);
assert.match(commentRoute, /author_id: user\.id/);
console.log("HoopFeed comment migration and API static safeguards passed (not live posting tests).");
