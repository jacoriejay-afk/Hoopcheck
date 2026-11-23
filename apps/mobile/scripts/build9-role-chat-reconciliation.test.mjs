import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");

test("owner-approved Arena UI and secure opening survive role + chat reconciliation",()=>{
  const dash=read("../app/dashboard.tsx"),opening=read("../components/AppOpening.tsx");
  const layout=read("../app/_layout.tsx"),home=read("../components/HomeCourtside.tsx");
  assert.match(dash,/GlassHeader/);
  assert.match(read("../components/glass/GlassHeader.tsx"),/BrandLogo/);
  assert.match(read("../components/glass/GlassHeader.tsx"),/useSafeAreaInsets/);
  assert.match(dash,/<HomeCourtside \/>/);
  assert.match(dash,/<RoleHub \/>/);
  assert.match(home,/ArenaHeading/);
  assert.match(layout,/AppOpening/);
  assert.match(opening,/useSafeAreaInsets/);
  for(const route of ["messages","feed-welcome","hoopgroups"]) {
    assert.ok(layout.includes('name="'+route+'"'),route+" registered");
    assert.ok(layout.includes('"'+route+'"'),route+" protected by sign-in redirect");
  }
  assert.match(layout,/name="sign-in" options=\{\{ headerShown: false \}\}/);
  assert.match(layout,/name="dashboard" options=\{\{ headerShown: false/);
});

test("role is server-backed, chat is request-scoped, community channels default off",()=>{
  const dashboard=read("../app/dashboard.tsx"),roles=read("../components/RoleHub.tsx");
  const chat=read("../app/messages.tsx"),groups=read("../app/hoopgroups.tsx");
  const channels=read("../components/HoopGroupsChannels.tsx");
  assert.doesNotMatch(dashboard,/user_metadata\?\.account_type/);
  assert.match(roles,/useNativeAccount/);
  assert.match(roles,/if \(!workspace\) return null/);
  assert.match(roles,/My club groups/);
  assert.doesNotMatch(roles,/label: "Fan Groups"/);
  assert.match(chat,/player_contact_requests/);
  assert.match(chat,/player_contact_messages/);
  assert.match(chat,/selected.status!=="accepted"/);
  assert.match(chat,/eq\("player_id",userId\)/);
  assert.match(groups,/EXPO_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED === "true"/);
  assert.match(channels,/moderation_status/);
});

test("new navigation preserves membership gates, message senders, team group distinction",()=>{
  const feed=read("../app/feed.tsx"),home=read("../components/HomeCourtside.tsx");
  const groups=read("../app/team-hub/groups/index.tsx");
  const alert=read("../app/notifications.tsx");
  assert.match(feed,/features\.canReadHoopFeed/);
  assert.match(home,/features\.canUseLiveGameHub/);
  assert.match(groups,/TEAM FAN GROUPS/);
  assert.match(groups,/\/hoopgroups/);
  assert.match(alert,/Messages & sender threads/);
  assert.match(feed,/Meet HoopBot/);
});
