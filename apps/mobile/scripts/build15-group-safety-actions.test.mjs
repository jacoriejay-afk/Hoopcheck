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
    assert.match(action,/if\(mutationLocked.current\)return/);
    assert.match(action,/finally\{mutationLocked.current=false;setBusy\(false\);\}/);
  }
});

test("channel refresh is bounded, foreground scoped, session verified and preserves newer drafts",()=>{
  assert.match(source,/if\(!alive\|\|running\|\|!\(AppState\.currentState==="active"\|\|AppState\.currentState===null\)\)return/);
  assert.match(source,/if\(!alive\|\|controller\.signal\.aborted\|\|current!==token\)throw Error/);
  assert.match(source,/setInterval\(\(\)=>void loadPosts\(\),25000\)/);
  assert.match(source,/clearInterval\(refreshTimer\);appState\.remove\(\);activeController\?\.abort\(\)/);
  assert.match(source,/setDraftState\(current => current\?\.channelId === channel\.id && current\.value === draft \? null : current\)/);
  assert.match(source,/accessibilityLabel="Refresh channel messages"/);
  assert.match(source,/!postLoading&&!postError&&postSnapshot\?\.channelId===channel\.id/);
  assert.match(source,/\.order\("created_at",\{ascending:false\}\)\.order\("id",\{ascending:false\}\)\.limit\(100\)/);
});

test("refresh verifies membership and does not restore a stale blocked member snapshot",()=>{
  assert.match(source,/const membership=await supabase\.from\("hoop_group_members"\)\.select\("space_id"\)\s*\.eq\("space_id",channel!\.space_id\)\.eq\("user_id",userId\)/);
  assert.match(source,/if\(membership\.data\?\.space_id!==channel!\.space_id\)\{\s*stopRealtime\(\);setJoined\(current=>current\.filter\(id=>id!==channel!\.space_id\)\);setPostSnapshot\(null\);return;/);
  assert.match(source,/if\(state==="active"\)\{if\(running\)resumePending=true;else void loadPosts\(\);\}/);
  assert.match(source,/if\(resumePending\)\{resumePending=false;void loadPosts\(\);\}/);
  assert.match(source,/async function block\(item:Post\)[\s\S]*?setPostRefresh\(value=>value\+1\)/);
});
