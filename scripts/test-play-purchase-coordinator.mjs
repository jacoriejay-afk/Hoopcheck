import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const load=(path,requires={})=>{const exports={};new Function("exports","require",ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,key=>{if(Object.hasOwn(requires,key))return requires[key];throw Error("Unexpected import");});return exports;};
const products=load("../lib/billing/play-products.ts");
const {createPlayPurchaseCoordinator}=load("../apps/mobile/src/native/playPurchaseCoordinator.ts",{"../../../../lib/billing/play-products":products});
const owner="11111111-1111-4111-8111-111111111111",accountId="a".repeat(64),now=Date.parse("2026-11-28T00:00:00Z");
const quote={productId:"hoopcheck.pro",basePlanId:"monthly",priceMicros:"4990000",currency:"USD"};
function fixture(){
 const calls=[],state={enabled:true,available:true,session:{owner,token:"fixture-session",role:"player"},now};
 const intent={...quote,owner,accountId,intentId:"22222222-2222-4222-8222-222222222222",environment:"test",expiresAt:now+30000};
 const item={accountId,productId:quote.productId,token:"synthetic-purchase-token"};
 const deps={enabled:()=>state.enabled,available:()=>state.available,session:async()=>state.session,now:()=>state.now,prepare:async()=>intent,launch:async()=>{calls.push("launch");return "launched";},restore:async()=>({accountId,candidates:[item,item],pendingCount:1}),sync:async()=>{calls.push("sync");return {owner,environment:"test",outcome:"test_fulfillment_confirmed"};}};
 const client=createPlayPurchaseCoordinator(deps);client.setOwner(owner);
 return {client,state,intent,deps,calls};
}
test("one reviewed intent can launch once; launch is not membership confirmation",async()=>{
 const f=fixture();assert.equal(await f.client.prepare(quote),true);assert.equal(await f.client.launch(),"launched");assert.equal(await f.client.launch(),"held");assert.deepEqual(f.calls,["launch"]);
});
test("disabled, expired, account switched, session replaced, role denied and changed price fail closed",async()=>{
 for(const change of [f=>f.state.enabled=false,f=>f.state.now+=31000,f=>f.client.setOwner("33333333-3333-4333-8333-333333333333"),f=>f.state.session={...f.state.session,token:"replacement"},f=>f.state.session={...f.state.session,role:"fan"},f=>f.client.invalidate()]){
  const f=fixture();assert.equal(await f.client.prepare(quote),true);change(f);assert.equal(await f.client.launch(),"held");assert.deepEqual(f.calls,[]);
 }
 const f=fixture();f.intent.priceMicros="6000000";assert.equal(await f.client.prepare(quote),false);assert.equal(await f.client.launch(),"held");
});
test("late intent and concurrent requests cannot open duplicate purchase sheets",async()=>{
 const f=fixture();let release;f.deps.prepare=()=>new Promise(r=>release=r);const pending=f.client.prepare(quote);await new Promise(r=>setImmediate(r));assert.equal(await f.client.prepare(quote),false);f.client.invalidate();release(f.intent);assert.equal(await pending,false);assert.equal(await f.client.launch(),"held");
});
test("restore deduplicates candidates, distinguishes pending, requires confirmed server outcome",async()=>{
 const f=fixture();assert.deepEqual(await f.client.recover(accountId),{verified:1,pending:1,failed:0});assert.deepEqual(f.calls,["sync"]);
 f.deps.sync=async()=>({owner,environment:"production",outcome:"test_fulfillment_confirmed"});assert.deepEqual(await f.client.recover(accountId),{verified:0,pending:1,failed:1});
});
test("late restore responses after logout or background cannot synchronize",async()=>{
 const f=fixture();let release;f.deps.restore=()=>new Promise(r=>release=r);const pending=f.client.recover(accountId);await new Promise(r=>setImmediate(r));f.client.setOwner(null);release({accountId,candidates:[{accountId,productId:quote.productId,token:"synthetic-purchase-token"}],pendingCount:0});assert.equal(await pending,null);assert.deepEqual(f.calls,[]);
});

test("launched, ambiguous and pending flows block a second sheet until clean recovery",async()=>{
 for(const launch of [async()=>"launched",async()=>{throw Error("disconnected");},async()=>"restore_required"]){
  const f=fixture();f.deps.launch=launch;assert.equal(await f.client.prepare(quote),true);await f.client.launch();
  assert.equal(await f.client.prepare(quote),false);
  assert.equal((await f.client.recover(accountId)).pending,1);assert.equal(await f.client.prepare(quote),false);
  f.deps.restore=async()=>({accountId,candidates:[],pendingCount:0});
  assert.deepEqual(await f.client.recover(accountId),{verified:0,pending:0,failed:0});
  assert.equal(await f.client.prepare(quote),true);
 }
});
test("explicit cancellation permits a new intent",async()=>{
 const f=fixture();f.deps.launch=async()=>"cancelled";assert.equal(await f.client.prepare(quote),true);
 assert.equal(await f.client.launch(),"cancelled");assert.equal(await f.client.prepare(quote),true);
});
