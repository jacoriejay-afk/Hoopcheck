import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
test("Settings exposes native blocked accounts and verified staff safety",()=>{
  const settings=read("../app/settings.tsx");
  assert.match(settings,/<BlockedAccounts \/>/);
  assert.match(settings,/<AdminSafetyCenter \/>/);
});
test("blocked account management is identity scoped and verifies exact delete",()=>{
  const src=read("../components/BlockedAccounts.tsx");
  assert.match(src,/<BlockList key=\{account\.user\.id\} uid=\{account\.user\.id\}/);
  assert.match(src,/from\("user_blocks"\)\.delete\(\)\.eq\("blocker_id",uid\)\.eq\("blocked_id",id\)\.select\("blocked_id"\)/);
  assert.match(src,/result\.data\?\.length!==1\|\|result\.data\[0\]\.blocked_id!==id/);
  assert.match(src,/Confirm unblock/);
  assert.match(src,/session\.user\.id!==uid/);
});
test("staff safety query only follows a verified server role and rechecks it before rendering",()=>{
  const src=read("../components/AdminSafetyCenter.tsx");
  assert.match(src,/auth\.getUser\(token\)/);
  assert.match(src,/role\.data!==true/);
  assert.ok(src.indexOf("role.data!==true")<src.indexOf('from("support_tickets")'));
  assert.match(src,/roleAfter\.data!==true/);
  assert.match(src,/if\(!verified\)return null/);
  assert.doesNotMatch(src,/service_role|user_metadata|\.update\(|\.delete\(/);
});

test("staff ticket status updates require a confirmed current security ticket and verified role",()=>{
  const src=read("../components/AdminSafetyCenter.tsx");
  assert.match(src,/Confirm status change/);
  assert.match(src,/role\.data!==true/);
  assert.match(src,/\.eq\("id",ticket\.id\)\.eq\("category","security"\)/);
  assert.match(src,/target\.data\.status!==ticket\.status/);
  assert.match(src,/rpc\("admin_update_support_ticket",\{p_ticket_id:ticket\.id,p_status:status\}\)\.setHeader/);
  assert.match(src,/result\.data!==true/);
  assert.match(src,/staff\.data!==true/);
  assert.match(src,/This is not a content removal or a finding of misconduct/);
});
