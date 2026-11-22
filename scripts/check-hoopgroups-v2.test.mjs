import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Members can discover, create and join user-owned communities without opening team fan groups",()=>{
  const page=read("app/hoopgroups/page.tsx");
  const manager=read("components/HoopGroupsManage.tsx");
  assert.match(page,/HoopGroupsManage/);
  assert.match(page,/discoverFilter/);
  assert.match(page,/discoverQuery/);
  assert.match(page,/async function join\(\)/);
  assert.match(page,/async function leave\(\)/);
  assert.match(page,/onCreated=\{async created/);
  assert.match(manager,/\.from\("hoop_group_spaces"\)/);
  assert.match(manager,/\.insert\(\{slug,name:cleanName/);
  assert.match(manager,/\.eq\("owner_id",initialUser\)/);
  assert.match(manager,/\.from\("hoop_group_channels"\)/);
  assert.match(manager,/channels\.length>=12/);
  assert.match(page,/NEXT_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED/);
  assert.match(page,/Team Fan Groups/);
});
test("Group and channel ownership requires database row policies and column-specific grants",()=>{
  const v1=read("supabase/candidates/hoopgroups_channels_v1_review_only.sql");
  const sql=read("supabase/candidates/hoopgroups_owner_spaces_v2_review_only.sql");
  assert.match(v1,/hoop_group_posts_insert_pending/);
  assert.match(sql,/hoop_group_spaces_create_owned/);
  assert.match(sql,/hoop_group_spaces_edit_owned/);
  assert.match(sql,/hoop_group_channels_create_owned/);
  assert.match(sql,/hoop_group_channels_rename_owned/);
  assert.match(sql,/owner_id = \(select auth\.uid\(\)\)/);
  assert.match(sql,/count\(\*\).*public\.hoop_group_spaces/s);
  assert.match(sql,/count\(\*\).*public\.hoop_group_channels/s);
  assert.match(sql,/grant update\(name,description,accent_color,icon_key\)/);
  assert.match(sql,/grant update\(name\) on public\.hoop_group_channels/);
  assert.doesNotMatch(sql,/grant update\([^)]*(?:owner_id|space_id|slug)/);
  assert.match(sql,/create trigger hoop_group_spaces_defaults_insert/);
  assert.match(sql,/security invoker set search_path = ''/);
  assert.doesNotMatch(sql,/\b(?:alter|update|delete from|drop|truncate|insert into)\s+(?:table\s+)?(?:public\.)?team_fan_groups\b/i);
});
test("Chat preferences are account and server scoped, not shared across identities",()=>{
  const prefs=read("components/HoopGroupsChatSettings.tsx");
  const page=read("app/hoopgroups/page.tsx");
  const css=read("app/hoopgroups/hoopgroups.css");
  assert.match(prefs,/"hc-hoopgroups-chat-v1:"\+userId\+":"\+spaceId/);
  assert.match(prefs,/localStorage\.setItem/);
  for(const key of ["density","style","scale"]) assert.match(prefs,new RegExp(key));
  assert.match(page,/chatPrefs\.density/);
  assert.match(page,/chatPrefs\.style/);
  assert.match(page,/chatPrefs\.scale/);
  assert.match(css,/\.hc-hoopgroups-chat\.is-compact/);
  assert.match(css,/\.hc-hoopgroups-chat\.is-plain/);
  assert.match(css,/\.hc-hoopgroups-chat\.is-large/);
  assert.match(page,/window\.setInterval/);
});
test("Invites require login and preserve the selected server slug",()=>{
  const page=read("app/hoopgroups/page.tsx");
  assert.match(page,/Copy invite/);
  assert.match(page,/get\("group"\)/);
  assert.match(page,/encodeURIComponent\(returnTo\)/);
});

test("Community owner moderation never exposes service keys or grants client UPDATE",()=>{
  const page=read("app/hoopgroups/page.tsx");
  const owner=read("components/HoopGroupsOwnerModeration.tsx");
  const route=read("app/api/hoopgroups/moderate/route.ts");
  const sql=read("supabase/candidates/hoopgroups_owner_spaces_v2_review_only.sql");
  assert.match(page,/HoopGroupsOwnerModeration/);
  assert.match(owner,/supabase\.auth\.getSession/);
  assert.match(owner,/Authorization/);
  assert.match(route,/authenticateModerationRequest/);
  assert.match(route,/HOOPGROUPS_CHANNELS_SERVER_ENABLED/);
  assert.match(route,/ownerChannels\(db,auth\.user\.id\)/);
  assert.match(route,/channels\.some\(channel=>channel\.id===post\.channel_id\)/);
  assert.match(route,/p_actor_id:auth\.user\.id/);
  assert.match(route,/moderate_hoop_group_post/);
  assert.match(sql,/join public\.hoop_group_spaces s on s\.id=c\.space_id/);
  assert.match(sql,/s\.owner_id=p_actor_id/);
  assert.match(sql,/revoke all on function public\.moderate_hoop_group_post/);
  assert.match(sql,/grant execute on function public\.moderate_hoop_group_post\(uuid,uuid,text\) to service_role/);
  assert.doesNotMatch(owner,/SUPABASE_SERVICE_ROLE_KEY|service_role/);
  assert.doesNotMatch(page,/SUPABASE_SERVICE_ROLE_KEY/);
});
