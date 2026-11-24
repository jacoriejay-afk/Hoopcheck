import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const source=readFileSync(new URL("../app/players/[id].tsx",import.meta.url),"utf8");
test("profile routes remount all private view and report state when target or viewer changes",()=>{
  assert.match(source,/const id = typeof rawId === "string" \? rawId : ""/);
  assert.match(source,/<PlayerAccess>\{viewer => <PlayerProfileDetails key=\{JSON\.stringify\(\[viewer\.id, viewer\.accountType, id\]\)\}/);
  assert.match(source,/function PlayerProfileDetails\(\{ viewer, id \}/);
  assert.match(source,/if \(!active\) return;\s*setPlayer\(result\)/);
  assert.match(source,/return \(\) => \{ active = false; \}/);
});
test("profile reporting validates current profile and exact viewer before sending",()=>{
  const report=source.slice(source.indexOf("async function submitReport()"),source.indexOf("const name = player"));
  assert.match(report,/reportSubmitting \|\| !player \|\| player\.id !== id/);
  assert.match(report,/session\.user\.id !== viewerId/);
  assert.match(report,/supabase\.auth\.getUser\(session\.access_token\)/);
  assert.match(report,/verified\.data\.user\?\.id !== viewerId/);
  assert.match(report,/Authorization: `Bearer \$\{session\.access_token\}`/);
  assert.match(report,/JSON\.stringify\(\{ profileId: player\.id, reason \}\)/);
});
test("loaded own player profile offers direct editor without changing browse entitlement",()=>{
  assert.match(source,/player\.id === viewerId && accountType === "player" \? <Button secondary onPress=\{\(\) => router\.push\("\/account\/edit"\)\}>Edit my profile/);
});
