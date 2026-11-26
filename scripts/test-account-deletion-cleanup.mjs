import test from "node:test";
import assert from "node:assert/strict";
import { removeApprovedAccountMedia, removeApprovedAuthIdentity, blockAndRevokeApprovedSessions } from "../lib/server/account-deletion-cleanup.ts";
const lease={requestId:"11111111-1111-4111-8111-111111111111",ownerId:"22222222-2222-4222-8222-222222222222",fence:"33333333-3333-4333-8333-333333333333",policyVersion:"fixture"};
const object={id:"44444444-4444-4444-8444-444444444444",bucket:"profile-avatars",path:lease.ownerId+"/fixture.png",ownerId:lease.ownerId,version:"v1"};
const plan={requestId:lease.requestId,ownerId:lease.ownerId,policyVersion:lease.policyVersion,objects:[object]};
const missing={status:404,code:"user_not_found"};
function fixture(){
 let current=object,user=true;
 const calls=[];
 const guards={assertLease:async()=>{},assertFrozen:async()=>{},readObject:async()=>current,assertNoRemainingMedia:async()=>{if(current)throw Error("Remaining media");},assertReadyForAuthDeletion:async()=>{}};
 const admin={storage:{from:bucket=>({remove:async paths=>{calls.push(["remove",bucket,paths]);current=null;return{error:null};}})},auth:{admin:{getUserById:async()=>user?{data:{user:{id:lease.ownerId}},error:null}:{data:{user:null},error:missing},deleteUser:async(id,soft)=>{calls.push(["delete",id,soft]);user=false;return{error:null};}}}};
 return {admin,guards,calls,change:value=>{current=value;}};
}
test("remove only approved current owner object; retry is idempotent",async()=>{
 const f=fixture();
 assert.equal((await removeApprovedAccountMedia(f.admin,lease,plan,f.guards)).confirmed,true);
 assert.equal((await removeApprovedAccountMedia(f.admin,lease,plan,f.guards)).confirmed,true);
 assert.deepEqual(f.calls,[["remove",object.bucket,[object.path]]]);
});
test("reject foreign media, team logos, duplicates, path traversal and replaced object before effects",async()=>{
 for(const bad of [{...object,ownerId:lease.requestId},{...object,bucket:"team-logos"},{...object,path:"../other.png"}]){
  const f=fixture();await assert.rejects(removeApprovedAccountMedia(f.admin,lease,{...plan,objects:[object,bad]},f.guards));assert.deepEqual(f.calls,[]);
 }
 const f=fixture();f.change({...object,version:"v2"});
 await assert.rejects(removeApprovedAccountMedia(f.admin,lease,plan,f.guards),/version changed/);assert.deepEqual(f.calls,[]);
 await assert.rejects(removeApprovedAccountMedia(f.admin,lease,{...plan,objects:[object,object]},f.guards),/Duplicate/);
});
test("missing write freeze or remaining media prevents acknowledged cleanup",async()=>{
 const f=fixture();f.guards.assertFrozen=async()=>{throw Error("not frozen");};
 await assert.rejects(removeApprovedAccountMedia(f.admin,lease,plan,f.guards),/not frozen/);assert.deepEqual(f.calls,[]);
 const g=fixture();g.guards.assertNoRemainingMedia=async()=>{throw Error("provider media remains");};
 await assert.rejects(removeApprovedAccountMedia(g.admin,lease,plan,g.guards),/provider media remains/);
});
test("hard delete requires all previous proofs, exact user and confirmed absence",async()=>{
 const f=fixture();f.guards.assertReadyForAuthDeletion=async()=>{throw Error("unresolved retention");};
 await assert.rejects(removeApprovedAuthIdentity(f.admin,lease,f.guards),/unresolved retention/);assert.deepEqual(f.calls,[]);
 f.guards.assertReadyForAuthDeletion=async()=>{};
 assert.equal((await removeApprovedAuthIdentity(f.admin,lease,f.guards)).confirmed,true);
 assert.equal((await removeApprovedAuthIdentity(f.admin,lease,f.guards)).confirmed,true);
 assert.deepEqual(f.calls,[["delete",lease.ownerId,false]]);
});
test("ambiguous missing-user response or non-removal cannot mark completion",async()=>{
 const f=fixture();f.admin.auth.admin.getUserById=async()=>({error:{status:404,code:"unexpected"}});
 await assert.rejects(removeApprovedAuthIdentity(f.admin,lease,f.guards),/lookup not confirmed/);assert.deepEqual(f.calls,[]);
 const g=fixture();g.admin.auth.admin.deleteUser=async()=>({error:null});
 await assert.rejects(removeApprovedAuthIdentity(g.admin,lease,g.guards),/absence not confirmed/);
});

function sessionFixture(){
 let banned=false,active=true;const calls=[];
 const rpc=async(name,args)=>{
  assert.equal(args.p_owner,lease.ownerId);assert.equal(args.p_request,lease.requestId);assert.equal(args.p_fence,lease.fence);
  return {error:null,data:name==="verify_deletion_auth_login_block"?banned:name==="verify_deletion_session_absence"?!active:name==="assert_deletion_frozen_session_step"};
 };
 const admin={rpc,auth:{getUser:async token=>({error:null,data:{user:{id:token==="owner-bearer"?lease.ownerId:lease.requestId}}}),
 admin:{updateUserById:async(id,options)=>{assert.equal(id,lease.ownerId);assert.equal(options.ban_duration,"8760h");calls.push("ban");banned=true;return{error:null,data:{user:{id}}};},
 signOut:async(token,scope)=>{assert.equal(token,"owner-bearer");assert.equal(scope,"global");calls.push("revoke");active=false;return{error:null};}}}};
 return{admin,guards:{assertLease:async()=>{},assertFrozen:async()=>{}},calls,clearSessions:()=>{active=false;}};
}
test("Auth ban is not session revocation; scheduled requests fail closed without a bearer",async()=>{
 const f=sessionFixture();
 await assert.rejects(blockAndRevokeApprovedSessions(f.admin,lease,f.guards),/Existing sessions require/);
 assert.deepEqual(f.calls,["ban"]);
 f.clearSessions();
 assert.equal((await blockAndRevokeApprovedSessions(f.admin,lease,f.guards)).confirmed,true);
 assert.deepEqual(f.calls,["ban"]);
});
test("verified owner bearer revokes global sessions, other owners never trigger effects",async()=>{
 const f=sessionFixture();
 await assert.rejects(blockAndRevokeApprovedSessions(f.admin,lease,f.guards,"other-bearer"),/owner mismatch/);
 assert.deepEqual(f.calls,[]);
 assert.equal((await blockAndRevokeApprovedSessions(f.admin,lease,f.guards,"owner-bearer")).confirmed,true);
 assert.deepEqual(f.calls,["ban","revoke"]);
});
test("ban acknowledgement and session absence require independent proof",async()=>{
 const f=sessionFixture();f.admin.auth.admin.updateUserById=async id=>({error:null,data:{user:{id}}});
 await assert.rejects(blockAndRevokeApprovedSessions(f.admin,lease,f.guards,"owner-bearer"),/login block not confirmed/);
 const g=sessionFixture();g.admin.auth.admin.signOut=async()=>({error:null});
 await assert.rejects(blockAndRevokeApprovedSessions(g.admin,lease,g.guards,"owner-bearer"),/sessions or login block not verified/);
 const h=sessionFixture();h.guards.assertFrozen=async()=>{throw Error("not frozen");};
 await assert.rejects(blockAndRevokeApprovedSessions(h.admin,lease,h.guards,"owner-bearer"),/not frozen/);assert.deepEqual(h.calls,[]);
});
