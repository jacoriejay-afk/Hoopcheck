import test from "node:test";
import assert from "node:assert/strict";
import { deletionSteps, runDeletionCandidate } from "../lib/server/account-deletion-orchestrator.ts";
const lease={requestId:"11111111-1111-4111-8111-111111111111",ownerId:"22222222-2222-4222-8222-222222222222",fence:"33333333-3333-4333-8333-333333333333",policyVersion:"fixture-v1",completed:[]};
function fixture(completed=[]){
 const events=[];let live=true;
 const current={...lease,completed};
 const adapter={enabled:async()=>true,claim:async()=>current,assertLease:async()=>{if(!live)throw Error("lost");},execute:async(l,s,key)=>{assert.equal(l.ownerId,lease.ownerId);assert.equal(key,lease.requestId+":"+s);events.push("execute:"+s);return{confirmed:true,receipt:"fixture-receipt"};},checkpoint:async(l,s)=>{events.push("checkpoint:"+s);},complete:async()=>{events.push("complete");},fail:async(l,code)=>{events.push("fail:"+code);}};
 return{adapter,events,lose:()=>{live=false;}};
}
test("disabled or empty queue never runs a deletion effect",async()=>{
 const f=fixture();f.adapter.enabled=async()=>false;f.adapter.claim=async()=>{throw Error("unexpected claim");};
 assert.equal(await runDeletionCandidate(f.adapter),"disabled");assert.deepEqual(f.events,[]);
 f.adapter.enabled=async()=>true;f.adapter.claim=async()=>null;assert.equal(await runDeletionCandidate(f.adapter),"idle");
});
test("completed notification and cleanup precede final completion",async()=>{
 const f=fixture();assert.equal(await runDeletionCandidate(f.adapter),"completed");
 assert.deepEqual(f.events,[...deletionSteps.flatMap(s=>["execute:"+s,"checkpoint:"+s]),"complete"]);
});
test("resume starts at the exact first unacknowledged step",async()=>{
 const f=fixture(deletionSteps.slice(0,5));assert.equal(await runDeletionCandidate(f.adapter),"completed");
 assert.equal(f.events[0],"execute:"+deletionSteps[5]);
 assert.equal(f.events.at(-1),"complete");
});
test("unconfirmed revocation never proceeds to media or identity deletion",async()=>{
 const f=fixture();const execute=f.adapter.execute;
 f.adapter.execute=async(l,s,k)=>s==="revoke_apple_authorizations"?{confirmed:false,receipt:""}:execute(l,s,k);
 assert.equal(await runDeletionCandidate(f.adapter),"retry");
 assert.equal(f.events.at(-1),"fail:step_not_confirmed");
 assert.ok(!f.events.some(x=>x.includes("delete_auth_identity")||x==="complete"));
});
test("lease loss prevents checkpoint, failure write and completion",async()=>{
 const f=fixture();f.adapter.execute=async()=>{f.lose();return{confirmed:true,receipt:"fixture"};};
 assert.equal(await runDeletionCandidate(f.adapter),"retry");assert.deepEqual(f.events,[]);
});
test("invalid checkpoint sequence refuses all side effects",async()=>{
 const f=fixture(["delete_auth_identity"]);await assert.rejects(runDeletionCandidate(f.adapter),/Invalid deletion lease/);assert.deepEqual(f.events,[]);
});
