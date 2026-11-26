import test from "node:test";
import assert from "node:assert/strict";
import { deletionSteps, runDeletionCandidate, createDeletionWorkerAdapter, revokeDeletionAppleAuthorizations } from "../lib/server/account-deletion-orchestrator.ts";
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

test("database bridge is disabled without explicit configuration and complete effects",async()=>{
 const prior=process.env.ACCOUNT_DELETION_WORKER_ENABLED;
 try{
  const calls=[];
  const rpc={rpc:async(name,args)=>{calls.push([name,args]);return {data:[],error:null};}};
  const effects=Object.fromEntries(deletionSteps.map(s=>[s,async()=>({confirmed:true,receipt:"fixture"})]));
  delete process.env.ACCOUNT_DELETION_WORKER_ENABLED;
  assert.equal(await runDeletionCandidate(createDeletionWorkerAdapter(rpc,effects,true)),"disabled");
  process.env.ACCOUNT_DELETION_WORKER_ENABLED="true";
  assert.equal(await runDeletionCandidate(createDeletionWorkerAdapter(rpc,{},true)),"disabled");
  assert.equal(await runDeletionCandidate(createDeletionWorkerAdapter(rpc,effects,false)),"disabled");
  assert.deepEqual(calls,[]);
  assert.equal(await runDeletionCandidate(createDeletionWorkerAdapter(rpc,effects,true)),"idle");
  assert.equal(calls[0][0],"claim_account_deletion_worker");
 }finally{if(prior===undefined)delete process.env.ACCOUNT_DELETION_WORKER_ENABLED;else process.env.ACCOUNT_DELETION_WORKER_ENABLED=prior;}
});
test("bridge binds every transition to exact request owner and fence",async()=>{
 const calls=[];
 const rpc={rpc:async(name,args)=>{calls.push([name,args]);return {data:name==="claim_account_deletion_worker"?[{request_id:lease.requestId,owner_id:lease.ownerId,fence:lease.fence,policy_version:lease.policyVersion,completed:[]}]:true,error:null};}};
 const effects=Object.fromEntries(deletionSteps.map(s=>[s,async(l,key)=>{assert.equal(l.ownerId,lease.ownerId);assert.equal(key,lease.requestId+":"+s);return{confirmed:true,receipt:"fixture"};}]));
 const a=createDeletionWorkerAdapter(rpc,effects,true);
 const claimed=await a.claim();
 assert.deepEqual(claimed,lease);
 await a.assertLease(claimed);await a.execute(claimed,"approve_scope",lease.requestId+":approve_scope");await a.checkpoint(claimed,"approve_scope","fixture");await a.complete(claimed);await a.fail(claimed,"step_not_confirmed");
 for(const [name,args] of calls.slice(1)){assert.equal(args.p_request,lease.requestId,name);assert.equal(args.p_owner,lease.ownerId,name);assert.equal(args.p_fence,lease.fence,name);}
});
test("bridge rejects false acknowledgements, RPC errors and malformed claims",async()=>{
 const a=createDeletionWorkerAdapter({rpc:async()=>({data:false,error:null})},{},true);
 await assert.rejects(a.assertLease(lease),/not confirmed/);
 await assert.rejects(a.claim(),/Invalid deletion claim/);
 const b=createDeletionWorkerAdapter({rpc:async()=>({data:true,error:{message:"private details"}})},{},true);
 await assert.rejects(b.complete(lease),/database acknowledgement failed/);
 const c=createDeletionWorkerAdapter({rpc:async()=>({data:[{request_id:lease.requestId,owner_id:lease.ownerId,fence:lease.fence,policy_version:lease.policyVersion,completed:["delete_auth_identity"]}],error:null})},{},true);
 await assert.rejects(c.claim(),/Invalid deletion claim/);
});

test("Apple revocation acknowledges exact owner and encrypted credential only after provider success",async()=>{
 const row={apple_subject:"subject",envelope:"v1.fixtureIV.fixtureTag.fixtureCiphertext",envelope_digest:"a".repeat(64)};
 const calls=[];let remaining=[row];
 const rpc={rpc:async(name,args)=>{assert.equal(args.p_owner,lease.ownerId);assert.equal(args.p_request,lease.requestId);assert.equal(args.p_fence,lease.fence);calls.push(name);if(name==="list_account_deletion_apple_revocations")return {data:remaining,error:null};if(name==="ack_account_deletion_apple_revocation"){assert.equal(args.p_subject,row.apple_subject);assert.equal(args.p_digest,row.envelope_digest);remaining=[];}return {data:true,error:null};}};
 assert.equal((await revokeDeletionAppleAuthorizations(rpc,lease,async(env,owner,subject)=>{assert.equal(env,row.envelope);assert.equal(owner,lease.ownerId);assert.equal(subject,row.apple_subject);calls.push("apple_200");})).confirmed,true);
 assert.deepEqual(calls,["list_account_deletion_apple_revocations","assert_account_deletion_worker","apple_200","ack_account_deletion_apple_revocation","list_account_deletion_apple_revocations"]);
});
test("provider error, stale acknowledgement and unrecognized vault scope fail closed",async()=>{
 const row={apple_subject:"subject",envelope:"v1.fixtureIV.fixtureTag.fixtureCiphertext",envelope_digest:"b".repeat(64)};
 let acked=0;
 const rpc={rpc:async(name)=>{if(name==="list_account_deletion_apple_revocations")return {data:[row],error:null};if(name==="ack_account_deletion_apple_revocation"){acked++;return{data:false,error:null};}return {data:true,error:null};}};
 await assert.rejects(revokeDeletionAppleAuthorizations(rpc,lease,async()=>{throw Error("Apple unavailable");}),/Apple unavailable/);assert.equal(acked,0);
 await assert.rejects(revokeDeletionAppleAuthorizations(rpc,lease,async()=>{}),/acknowledgement failed/);assert.equal(acked,1);
 await assert.rejects(revokeDeletionAppleAuthorizations({rpc:async()=>({data:[{...row,envelope:"invalid"}],error:null})},lease,async()=>{throw Error("Unexpected revoke");}),/Invalid Apple revocation scope/);
});
