import assert from "node:assert/strict";
import test from "node:test";
import {createHash,generateKeyPairSync} from "node:crypto";
import {encryptAppleToken,revokeAppleAuthorization} from "../lib/server/apple-sign-in-authorization.ts";
import {revokeDeletionAppleAuthorizations} from "../lib/server/account-deletion-orchestrator.ts";

const lease={requestId:"11111111-1111-4111-8111-111111111111",ownerId:"22222222-2222-4222-8222-222222222222",fence:"33333333-3333-4333-8333-333333333333",policyVersion:"fixture-v1",completed:[]};
const subject="fixture.apple.subject",token="synthetic-refresh-token",key=Buffer.alloc(32,7).toString("base64");
const config={teamId:"FIXTURE001",keyId:"FIXTURE002",privateKey:generateKeyPairSync("ec",{namedCurve:"prime256v1"}).privateKey.export({format:"pem",type:"pkcs8"}).toString()};
function fixture(owner=lease.ownerId,options={}){
 const envelope=encryptAppleToken(token,owner,subject,key);
 const digest=createHash("sha256").update(envelope).digest("hex");
 let rows=[{apple_subject:subject,envelope,envelope_digest:digest}],calls=[];
 const rpc={rpc:async(name,args)=>{
  assert.equal(args.p_request,lease.requestId);
  assert.equal(args.p_owner,lease.ownerId);
  assert.equal(args.p_fence,lease.fence);
  if(name==="list_account_deletion_apple_revocations")return{data:rows,error:null};
  if(name==="assert_account_deletion_worker")return{data:!options.stale,error:null};
  if(name==="ack_account_deletion_apple_revocation"){
   calls.push("ack");assert.equal(args.p_subject,subject);assert.equal(args.p_digest,digest);
   rows=[];return{data:true,error:null};
  }
  throw Error("Unexpected RPC");
 }};
 const provider=async(url,init)=>{
  calls.push("provider");assert.equal(url,"https://appleid.apple.com/auth/revoke");
  assert.equal(init.method,"POST");assert.equal(init.redirect,"error");
  const body=new URLSearchParams(init.body);
  assert.equal(body.get("client_id"),"online.hoopcheck.app");
  assert.equal(body.get("token"),token);
  assert.equal(body.get("token_type_hint"),"refresh_token");
  assert.equal(body.get("client_secret").split(".").length,3);
  return new Response(null,{status:options.fail?503:200});
 };
 return {rpc,calls,rows:()=>rows,revoke:(encrypted,owner,sub)=>revokeAppleAuthorization(encrypted,owner,sub,key,config,provider)};
}
test("actual Apple vault envelope is revoked before database acknowledgement",async()=>{
 const f=fixture();
 assert.deepEqual(await revokeDeletionAppleAuthorizations(f.rpc,lease,f.revoke),{confirmed:true,receipt:"apple_revocations_verified"});
 assert.deepEqual(f.calls,["provider","ack"]);assert.deepEqual(f.rows(),[]);
 await revokeDeletionAppleAuthorizations(f.rpc,lease,f.revoke);
 assert.deepEqual(f.calls,["provider","ack"]);
});
test("wrong owner envelope or lost lease never reaches Apple or acknowledgement",async()=>{
 for(const f of [fixture(lease.fence),fixture(lease.ownerId,{stale:true})]){
  await assert.rejects(revokeDeletionAppleAuthorizations(f.rpc,lease,f.revoke));
  assert.deepEqual(f.calls,[]);assert.equal(f.rows().length,1);
 }
});
test("actual provider rejection keeps encrypted credential available for retry",async()=>{
 const f=fixture(lease.ownerId,{fail:true});
 await assert.rejects(revokeDeletionAppleAuthorizations(f.rpc,lease,f.revoke));
 assert.deepEqual(f.calls,["provider"]);assert.equal(f.rows().length,1);
});
