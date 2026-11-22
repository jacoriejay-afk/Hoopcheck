import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) => readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("native role screens register behind the existing sign-in guard and preserve arena launch",()=>{
  const layout=read("app/_layout.tsx");
  for(const name of ["messages","feed-welcome","hoopgroups"]){
    assert.match(layout,new RegExp('<Stack\\.Screen name="'+name+'"'));
    assert.match(layout,new RegExp('"'+name+'"'));
  }
  assert.match(layout,/<Stack\.Screen name="sign-in" options=\{\{ headerShown: false \}\}/);
  assert.match(layout,/<AppOpening/);
});
test("all user types receive real role-sensitive links without replacing Arena Home",()=>{
  const dashboard=read("app/dashboard.tsx");
  for(const role of ["player","fan","coach","agent","scout","manager","club_admin"])assert.match(dashboard,new RegExp("(?:^|\\n)\\s*(?:roleActions\\.)?"+role+"\\s*[:=]","m"));
  assert.match(dashboard,/<BrandLogo onHero \/>/);
  assert.match(dashboard,/<HomeCourtside \/>/);
  assert.match(dashboard,/router\.push\(item\.path\)/);
  assert.match(dashboard,/minHeight: 44/);
});
test("private HoopChat only loads accepted threads and writes caller identity",()=>{
  const messages=read("app/messages.tsx");
  assert.match(messages,/\.or\(`requester_id\.eq\.\$\{user\.id\},player_id\.eq\.\$\{user\.id\}`\)/);
  assert.match(messages,/item\.status==="accepted"/);
  assert.match(messages,/\.eq\("player_id",userId\)\.eq\("status","pending"\)/);
  assert.match(messages,/\.insert\(\{request_id:selected\.id,sender_id:userId/);
  assert.match(messages,/user\?\.id!==userId/);
});
test("Fan Groups and topic HoopGroups remain distinct with disabled channel rollout",()=>{
  const clubs=read("app/team-hub/groups/index.tsx"),topics=read("app/hoopgroups.tsx");
  assert.match(clubs,/TEAM FAN GROUPS/);
  assert.match(clubs,/router\.push\("\/hoopgroups"\)/);
  assert.match(topics,/EXPO_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED === "true"/);
  assert.match(topics,/Channels are not live until the backend and moderation release is approved/i);
});
test("HoopFeed welcomes with clearly labeled HoopBot without bypassing membership",()=>{
  const feed=read("app/feed.tsx"),welcome=read("app/feed-welcome.tsx");
  assert.match(feed,/canReadHoopFeed/);
  assert.match(feed,/\/feed-welcome/);
  assert.match(welcome,/HOOPBOT · AUTOMATED GUIDE/);
  assert.match(welcome,/not a real person or live chat assistant/);
});
