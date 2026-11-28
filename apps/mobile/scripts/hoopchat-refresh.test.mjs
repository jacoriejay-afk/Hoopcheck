import {test} from "node:test";
import assert from "node:assert/strict";
import {createChatRefreshCoordinator} from "../src/native/hoopChatRefresh.ts";
const delay=()=>new Promise(r=>setTimeout(r,20));
test("reconnection and event bursts do not refresh during a mutation; next tick recovers",async()=>{
 let active=true,busy=true,calls=0;const q=createChatRefreshCoordinator(()=>active,()=>busy,()=>calls++,2);
 q.request();q.request();await delay();assert.equal(calls,0);
 busy=false;q.request();q.request();q.request();await delay();assert.equal(calls,1);
 q.request();active=false;q.suspend();await delay();assert.equal(calls,1);
 active=true;q.request();await delay();assert.equal(calls,2);
 q.request();q.dispose();await delay();assert.equal(calls,2);
 q.request();await delay();assert.equal(calls,2);
});
