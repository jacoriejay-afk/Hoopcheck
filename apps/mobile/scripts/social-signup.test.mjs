import assert from "node:assert/strict";
import { test } from "node:test";
import { pendingSignup, completePendingSignup } from "../src/native/socialSignup.ts";
const apple={id:"owner-a",role:"hoopcheck_pending_signup",app_metadata:{provider:"apple"}};
const google={id:"owner-g",role:"hoopcheck_pending_signup",app_metadata:{provider:"google"}};
const session=user=>({user,access_token:"fixture-"+user.id});
const fixture=user=>{const calls=[];let current=session(user);return {calls,change:x=>{current=x;},deps:{session:async()=>current,verifiedUser:async token=>{assert.equal(token,"fixture-"+user.id);return user;},submit:async(...args)=>{calls.push(args);},refresh:async()=>{calls.push("refresh");return current&&session({...current.user,role:"authenticated"});}}};};
test("only restricted Apple or Google identities enter social setup",()=>{
 assert.deepEqual(pendingSignup(apple),{owner:"owner-a",provider:"apple"});
 assert.deepEqual(pendingSignup(google),{owner:"owner-g",provider:"google"});
 assert.equal(pendingSignup({...apple,role:"authenticated"}),null);
 assert.equal(pendingSignup({...apple,app_metadata:{provider:"email"}}),null);
 assert.equal(pendingSignup(null),null);
});
test("both providers use the correct RPC and pinned owner token",async()=>{
 for(const user of [apple,google]){
  const {deps,calls}=fixture(user),metadata={username:"fixture"};
  assert.equal(await completePendingSignup(pendingSignup(user),metadata,deps),user.id);
  assert.deepEqual(calls,[["complete_"+user.app_metadata.provider+"_signup","fixture-"+user.id,metadata],"refresh"]);
 }
});
test("wrong owner or wrong provider stops before account completion",async()=>{
 const f=fixture(google);
 await assert.rejects(completePendingSignup(pendingSignup(apple),{},f.deps),/account changed/);
 await assert.rejects(completePendingSignup({owner:google.id,provider:"apple"},{},f.deps),/Verify your social account/);
 assert.deepEqual(f.calls,[]);
});
test("session change during identity verification prevents RPC",async()=>{
 const f=fixture(apple);
 f.deps.verifiedUser=async()=>{f.change(session(google));return apple;};
 await assert.rejects(completePendingSignup(pendingSignup(apple),{},f.deps),/account changed/);
 assert.deepEqual(f.calls,[]);
});
test("session change during RPC prevents refresh and navigation",async()=>{
 const f=fixture(apple);
 f.deps.submit=async(rpc,token)=>{assert.equal(token,"fixture-owner-a");f.change(session(google));};
 await assert.rejects(completePendingSignup(pendingSignup(apple),{},f.deps),/account changed/);
 assert.deepEqual(f.calls,[]);
});
test("unpromoted or different refreshed identity fails closed",async()=>{
 for(const user of [apple,{...google,role:"authenticated"}]){
  const f=fixture(apple);f.deps.refresh=async()=>session(user);
  await assert.rejects(completePendingSignup(pendingSignup(apple),{},f.deps),/Sign in again/);
 }
});
