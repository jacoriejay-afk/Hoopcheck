import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

// Only a validated, currently authorized moderator may hide approved videos.
const action = read("app/api/admin/reel-moderation/route.ts");
for (const marker of [
  'getUser(token)', 'is_current_user_admin_or_moderator',
  'hide_approved_reel_for_moderation', 'p_moderator_id: user.id',
  'p_support_ticket_id: ticketId', 'reason.trim().length < 25',
  'SUPABASE_SERVICE_ROLE_KEY'
]) assert.ok(action.includes(marker), "Missing Reel moderation control: " + marker);
assert.ok(!action.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"));
assert.ok(!action.includes('.from("feed_posts").update('), "Post status must be transactional");

const migration = read("supabase/migrations/20261122235000_phase5_reel_moderation.sql");
for (const marker of [
  "create table if not exists public.reel_moderation_actions",
  "enable row level security",
  "security invoker",
  "set search_path = ''",
  "revoke all on public.reel_moderation_actions from public, anon, authenticated",
  "grant execute on function public.hide_approved_reel_for_moderation",
  "to service_role",
  "where f.id = p_reel_id and f.status = 'approved' and f.video_url is not null",
  "insert into public.reel_moderation_actions"
]) assert.ok(migration.includes(marker), "Missing SQL safeguard: " + marker);
assert.ok(!/security definer|grant execute.*authenticated/i.test(migration), "Privilege elevation not allowed");
assert.ok(!/alter table public\.profiles/i.test(migration), "Profile boundaries cannot change");

const queue = read("app/admin/safety-center/page.tsx");
for (const marker of [
  'is_current_user_admin_or_moderator', '.eq("category", "security")',
  'admin_update_support_ticket', '/api/admin/reel-moderation',
  'confirmed[ticket.id]', 'Request', 'Scam', 'Private ticket'
]) assert.ok(queue.includes(marker), "Missing queue gate: " + marker);
assert.ok(!/\.insert\(\{[^}]*published|\.from\("scam_alert/i.test(queue), "No public scam accusations");

const viewer = read("app/reels/ReelsViewer.tsx");
for (const marker of ['reportReel=', 'user_blocks', 'hideCreator', 'blockCreator']) {
  assert.ok(viewer.includes(marker), "Reels must retain report, hide and block: " + marker);
}
const gate = read("app/reels/page.tsx");
assert.ok(gate.includes('NEXT_PUBLIC_HOOPCHECK_REELS_ENABLED !== "true"'), "Do not bypass public Reels release gate");

const games = read("app/live-games/page.tsx");
for (const marker of [
  "getGameAvailability", "countryFocus", "leagueFocus",
  "discoveryShortcuts", "presenceCounts[b.game.id]",
  "formatViewerLocalTime", "status.toLowerCase() === \"live\""
]) assert.ok(games.includes(marker), "Missing live integrity: " + marker);
assert.ok(read("app/admin/directory/page.tsx").includes("/admin/safety-center"));
console.log("Phase 5 safety, privacy, Reels and Live Games invariants passed.");
