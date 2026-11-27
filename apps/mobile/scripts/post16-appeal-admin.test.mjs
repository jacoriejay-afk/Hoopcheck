import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("appeals are private authenticated support tickets, not automatic reversals",()=>{
  const src=read("../components/ModerationAppeal.tsx");
  assert.match(src,/requester_id:uid,subject:"Moderation appeal",category:"security"/);
  assert.match(src,/supabase\.auth\.getUser\(token\)/);
  assert.match(src,/session\.data\.session\.user\.id!==uid/);
  assert.match(src,/detail\.length<25\|\|detail\.length>2000/);
  assert.match(src,/Submission does not reverse a moderation decision/);
  assert.match(read("../app/account/support.tsx"),/<ModerationAppeal uid=\{uid\}/);
});
test("access diagnostic only reads authoritative staff and owner grants",()=>{
  const src=read("../components/StaffAccessCheck.tsx");
  for(const rpc of ["get_current_user_admin_role","is_current_user_admin_or_moderator","is_approved_claim_owner"]) assert.ok(src.includes('rpc("'+rpc+'")'));
  assert.match(src,/auth\.getUser\(token\)/);
  assert.match(src,/after\.data\.session\?\.user\.id!==uid/);
  assert.doesNotMatch(src,/\.insert\(|\.update\(|\.delete\(|user_metadata|service_role/);
  assert.match(read("../app/settings.tsx"),/<StaffAccessCheck \/>/);
});
test("native video removal requires an exact security ticket, staff role and confirmed evidence",()=>{
  const src=read("../components/StaffReelModeration.tsx");
  assert.match(src,/ticket\.subject==="Report a HoopFeed Reel"/);
  assert.match(src,/!confirmed\|\|!postId\|\|evidence\.length<25\|\|evidence\.length>1000/);
  assert.match(src,/role\.data!==true/);
  assert.match(src,/\.eq\("id",ticket\.id\)\.eq\("category","security"\)/);
  assert.match(src,/target\(row\.data\)!==postId/);
  assert.match(src,/\/api\/admin\/reel-moderation/);
  assert.match(src,/redirect:"error",cache:"no-store"/);
  assert.match(src,/result\.hidden!==true/);
  assert.doesNotMatch(src,/\.update\(|\.delete\(|service_role/);
  assert.match(read("../components/AdminSafetyCenter.tsx"),/<StaffReelModeration key=\{ticket\.id\}/);
});
