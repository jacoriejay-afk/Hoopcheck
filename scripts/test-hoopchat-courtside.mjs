import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Courtside routes share one private messenger",()=>{
 const inbox=read("components/HoopChatInbox.tsx");
 const page=read("app/messages/page.tsx");
 const notifications=read("app/notifications/page.tsx");
 assert.match(inbox,/from "\.\/HoopChatCourtside"/);
 assert.match(page,/HoopChatCourtside/);
 assert.match(notifications,/Open full Courtside inbox/);
 assert.match(read("app/dashboard/HomeCourtSpace.tsx"),/href:"\/messages"/);
 assert.match(read("components/RoleQuickLinks.tsx"),/href:"\/messages"/);
});
test("Messages retain consent and role restrictions from existing HoopChat",()=>{
 const ui=read("components/HoopChatCourtside.tsx");
 const requestSql=read("supabase/migrations/20261008105244_enable_player_hoopchat_realtime.sql");
 assert.match(ui,/selected\.status!=="accepted"/);
 assert.match(ui,/selected\.player_id!==userId/);
 assert.match(ui,/\.eq\("status","pending"\)/);
 assert.match(ui,/\.eq\("player_id",userId\)/);
 assert.match(ui,/supabase\.auth\.getUser\(\)/);
 assert.match(ui,/\.from\("player_contact_messages"\)/);
 assert.match(ui,/sender_id:userId/);
 assert.match(requestSql,/accepted participants can view messages/);
 assert.match(requestSql,/accepted participants can send messages/);
 assert.doesNotMatch(ui,/SUPABASE_SERVICE_ROLE_KEY|service_role|dangerouslySetInnerHTML/);
});
test("Cross-account session changes invalidate pending queries and subscriptions",()=>{
 const ui=read("components/HoopChatCourtside.tsx");
 assert.match(ui,/accountGeneration\.current\+=1/);
 assert.match(ui,/loadSequence\.current\+=1/);
 assert.match(ui,/supabase\.auth\.onAuthStateChange/);
 assert.match(ui,/subscription\.unsubscribe\(\)/);
 assert.match(ui,/revision===accountGeneration\.current/);
 assert.match(ui,/supabase\.removeChannel\(channel\)/);
 assert.match(ui,/postgres_changes/);
 assert.match(ui,/window\.clearInterval\(timer\)/);
});
test("Unread and personalization are device-scoped without storing message body",()=>{
 const ui=read("components/HoopChatCourtside.tsx");
 const core=read("lib/hoopchat-courtside.ts");
 assert.match(ui,/localStorage\.setItem\(key,value\)/);
 assert.match(ui,/hc-courtside-appearance-v1/);
 assert.match(ui,/hc-courtside-threads-v1/);
 assert.match(core,/export function unreadCount/);
 assert.match(core,/sender_id!==me/);
 assert.match(core,/export function parseAppearance/);
 assert.match(core,/export function parseThreadPreferences/);
 assert.match(core,/Break the ice/);
 assert.match(core,/Film room/);
 assert.match(ui,/STARTERS\.map/);
 assert.match(ui,/Nothing sends automatically|nothing sends automatically/);
 assert.doesNotMatch(ui,/setItem\([^\n]*\.body/);
});
test("Courtside layout is resilient at narrow screen sizes and honors both themes",()=>{
 const css=read("components/HoopChatCourtside.css");
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/max\(12px,env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(css,/prefers-reduced-motion:no-preference/);
 assert.match(css,/\.hc-courtside--classic/);
 assert.match(css,/\.hc-courtside--compact/);
 assert.match(css,/\.hc-courtside--large/);
 assert.match(css,/hc-card-surface/);
 assert.match(css,/:focus-visible/);
});
