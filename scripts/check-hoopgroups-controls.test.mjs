import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("HoopGroups remains behind independently controlled public and moderation gates",()=>{
  const page=read("app/hoopgroups/page.tsx");
  const moderator=read("app/api/admin/hoopgroups/route.ts");
  assert.match(page,/NEXT_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED/);
  assert.match(moderator,/HOOPGROUPS_CHANNELS_SERVER_ENABLED/);
  assert.match(moderator,/authorizeModeratorRequest/);
  assert.match(moderator,/moderate_hoop_group_post/);
});
test("Members can join, leave and manually refresh moderated channels",()=>{
  const page=read("app/hoopgroups/page.tsx");
  const css=read("app/hoopgroups/hoopgroups.css");
  assert.match(page,/async function join\(\)/);
  assert.match(page,/async function leave\(\)/);
  assert.match(page,/\.delete\(\)\.eq\("space_id",selected\.id\)\.eq\("user_id",userId\)/);
  assert.match(page,/async function refresh\(\)/);
  assert.match(page,/Refresh messages/);
  assert.match(page,/Leave group/);
  assert.doesNotMatch(page,/href="\/team-hub\/groups"/, "HoopGroups directory should be independent of official club Fan Groups");
  assert.match(css,/\.hc-hoopgroups-refresh/);
  assert.match(css,/min-height:44px/);
});
test("Review-only schema enforces private messages and server-only moderation",()=>{
  const sql=read("supabase/candidates/hoopgroups_channels_v1_review_only.sql");
  assert.match(sql,/DO NOT APPLY TO PRODUCTION/);
  assert.match(sql,/alter table public\.hoop_group_posts enable row level security/);
  assert.match(sql,/hoop_group_posts_read_visible/);
  assert.match(sql,/moderation_status='approved' or author_id=\(select auth\.uid\(\)\)/);
  assert.match(sql,/revoke all on function public\.moderate_hoop_group_post/);
  assert.match(sql,/grant execute on function public\.moderate_hoop_group_post\(uuid,uuid,text\) to service_role/);
  assert.doesNotMatch(sql,/\b(?:alter|update|delete from|drop|truncate|insert into)\s+(?:table\s+)?(?:public\.)?team_fan_groups\b/i, "Backend candidate must not mutate Team Fan Groups");
});

test("Auth changes clear account-specific HoopGroups state and cancel stale responses",()=>{
  const page=read("app/hoopgroups/page.tsx");
  assert.match(page,/supabase\.auth\.onAuthStateChange\(/);
  assert.match(page,/event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED"/);
  assert.match(page,/subscription\.unsubscribe\(\)/);
  assert.match(page,/loadGeneration\.current \+= 1/);
  assert.match(page,/setUserId\(""\); setPosts\(\[\]\)/);
  assert.match(page,/setMemberships\(\[\]\); setDraft\(""\); setAccountRole\(""\)/);
  assert.match(page,/if \(generation !== loadGeneration\.current\) return;/);
  assert.match(page,/channelRef\.current===activeChannel/);
  assert.match(page,/channelRef\.current === activeChannel/);
  assert.match(page,/if \(generation === loadGeneration\.current\)/);
});
