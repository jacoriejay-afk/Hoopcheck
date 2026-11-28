import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {createGroupRefreshQueue} from "../src/native/hoopGroupsRefresh.ts";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test("realtime invalidation coalesces bursts and stops after lost scope",async()=>{
 let active=true,reads=0;
 const queue=createGroupRefreshQueue(()=>active,()=>reads++,1);
 try{
  queue.request();queue.request();queue.request();await sleep(15);assert.equal(reads,1);
  queue.request();active=false;await sleep(15);assert.equal(reads,1);
  active=true;queue.request();queue.cancel();await sleep(15);assert.equal(reads,1);
  queue.request();await sleep(15);assert.equal(reads,2);
  queue.dispose();queue.request();await sleep(15);assert.equal(reads,2);
 }finally{queue.dispose();}
});
test("web and native use channel-scoped invalidation only after verified reads; clean up on lifecycle changes",()=>{
 const native=readFileSync(new URL("../components/HoopGroupsChannels.tsx",import.meta.url),"utf8");
 const web=readFileSync(new URL("../../../app/hoopgroups/page.tsx",import.meta.url),"utf8");
 for(const source of [native,web]){
  assert.match(source,/table:"hoop_group_posts",filter\},\(\)=>queue\.request\(\)/);
  assert.match(source,/const filter="channel_id=eq\."\+/);
  assert.match(source,/status==="SUBSCRIBED"\)queue\.request\(\)/);
  assert.match(source,/supabase\.removeChannel\(previous\)/);
  assert.match(source,/stopRealtime\(\);queue\.dispose\(\)/);
  assert.match(source,/startRealtime\(\);/);
  assert.match(source,/HOOPGROUPS_REALTIME_ENABLED!=="true"/);
  assert.match(source,/setInterval/);
 }
 assert.match(native,/post\.moderation_status==="approved"\|\|post\.author_id===userId&&post\.moderation_status==="pending"/);
});
