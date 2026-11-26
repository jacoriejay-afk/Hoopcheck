import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
const src=readFileSync(new URL("../app/players/[id].tsx",import.meta.url),"utf8");
test("player profile checks viewer-owned block before reading target profile",()=>{
  assert.match(src,/from\("user_blocks"\)\.select\("blocked_id"\)\.eq\("blocker_id",viewerId\)\.eq\("blocked_id",id\)/);
  assert.ok(src.indexOf('if(block.data)')<src.indexOf("const result = await readPlayerProfile"));
  assert.match(src,/if\(block\.error\|\|controller\.signal\.aborted\)/);
});
test("block action confirms target and uses authenticated viewer row only",()=>{
  assert.match(src,/Confirm block/);
  assert.match(src,/id===viewerId\|\|!isFeedId\(id\)/);
  assert.match(src,/insert\(\{blocker_id:viewerId,blocked_id:id\}\)\.setHeader/);
  assert.match(src,/row\.data\?\.blocked_id!==id/);
  assert.match(src,/after\.data\.session\?\.user\.id===viewerId/);
});
