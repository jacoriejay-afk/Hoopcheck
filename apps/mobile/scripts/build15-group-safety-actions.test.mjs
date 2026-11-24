import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const source=readFileSync(new URL("../components/HoopGroupsChannels.tsx",import.meta.url),"utf8");
test("report and block require membership, current message and verified fixed bearer",()=>{
  const auth=source.slice(source.indexOf("async function safetyToken()"),source.indexOf("async function report("));
  assert.match(auth,/await requireOnline\(\)/);
  assert.match(auth,/readWithDeadline\(\(\)=>supabase\.auth\.getSession\(\)\)/);
  assert.match(auth,/session\.data\.session\?\.user\.id!==userId/);
  assert.match(auth,/supabase\.auth\.getUser\(token\)/);
  assert.match(auth,/verified\.data\.user\?\.id!==userId/);
  for(const [start,end] of [["async function report(","async function block("],["async function block(","function actions("]]){
    const action=source.slice(source.indexOf(start),source.indexOf(end));
    assert.match(action,/!member/);
    assert.match(action,/!posts\.some\(post=>post\.id===item\.id\)/);
    assert.match(action,/const token=await safetyToken\(\)/);
    assert.match(action,/\.setHeader\("Authorization", "Bearer "\+token\)/);
    assert.match(action,/catch\(failure\)/);
    assert.match(action,/finally\{setBusy\(false\);\}/);
  }
});
