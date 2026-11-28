import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const load=(path,requires={})=>{const exports={};new Function("exports","require",ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,key=>{if(Object.hasOwn(requires,key))return requires[key];throw Error("Unexpected import");});return exports;};
const products=load("../lib/billing/play-products.ts");
const {createPlayRecoveryJournal}=load("../apps/mobile/src/native/playRecoveryJournal.ts");
const {createPlayPurchaseCoordinator}=load("../apps/mobile/src/native/playPurchaseCoordinator.ts",{"../../../../lib/billing/play-products":products});
const owner="11111111-1111-4111-8111-111111111111",accountId="a".repeat(64),now=Date.parse("2026-11-28T00:00:00Z");
const quote={productId:"hoopcheck.pro",basePlanId:"monthly",priceMicros:"4990000",currency:"USD"};
function fixture(){
 const calls=[],state={enabled:true,available:true,session:{owner,token:"fixture-session",role:"player"},now};
 const intent={...quote,owner,accountId,intentId:"22222222-2222-4222-8222-222222222222",environment:"test",expiresAt:now+30000};
 const item={accountId,productId:quote.productId,token:"synthetic-purchase-token"};
 let stored=null;
 const storage={read:async()=>stored,write:async value=>{stored=value;},remove:async()=>{stored=null;}};
 const journal=createPlayRecoveryJournal(storage);
 const deps={journal,enabled:()=>state.enabled,available:()=>state.available,session:async()=>state.session,now:()=>state.now,prepare:async()=>intent,consume:async()=>({owner,intentId:intent.intentId,environment:"test",outcome:"sandbox_launch_authorized",membershipGranted:false}),accountIdentity:async()=>({owner,accountId,environment:"test"}),launch:async()=>{calls.push("launch");return "launched";},restore:async()=>({accountId,candidates:[item,item],pendingCount:1}),sync:async()=>{calls.push("sync");return {owner,environment:"test",outcome:"test_fulfillment_confirmed"};}};
 const client=createPlayPurchaseCoordinator(deps);client.setOwner(owner);
 return {client,state,intent,deps,calls,storage};
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

test("native launch requires exact server consumption and rechecks account after response",async()=>{
 for(const permit of [null,{owner,environment:"production"},{owner,environment:"test",intentId:"wrong",outcome:"sandbox_launch_authorized",membershipGranted:false}]){
  const f=fixture();f.deps.consume=async()=>permit;assert.equal(await f.client.prepare(quote),true);assert.equal(await f.client.launch(),"held");assert.deepEqual(f.calls,[]);
 }
 const f=fixture();f.deps.consume=async()=>{f.client.setOwner(null);return {owner,intentId:f.intent.intentId,environment:"test",outcome:"sandbox_launch_authorized",membershipGranted:false};};
 assert.equal(await f.client.prepare(quote),true);assert.equal(await f.client.launch(),"held");assert.deepEqual(f.calls,[]);
});
test("restore requires authenticated identity and rejects conflicting token products before syncing",async()=>{
 const f=fixture();f.deps.accountIdentity=async()=>({owner,accountId:"b".repeat(64),environment:"test"});assert.equal(await f.client.recover(accountId),null);assert.deepEqual(f.calls,[]);
 const g=fixture();g.deps.restore=async()=>({accountId,pendingCount:0,candidates:[{accountId,productId:"hoopcheck.pro",token:"synthetic-purchase-token"},{accountId,productId:"hoopcheck.premium",token:"synthetic-purchase-token"}]});assert.equal(await g.client.recover(accountId),null);assert.deepEqual(g.calls,[]);
});
test("a different owner cannot clear an interrupted purchase fence",async()=>{
 const f=fixture();assert.equal(await f.client.prepare(quote),true);assert.equal(await f.client.launch(),"launched");
 const other="44444444-4444-4444-8444-444444444444",otherAccount="b".repeat(64);
 f.client.setOwner(other);f.state.session={owner:other,token:"other-session",role:"player"};
 f.deps.accountIdentity=async()=>({owner:other,accountId:otherAccount,environment:"test"});
 f.deps.restore=async()=>({accountId:otherAccount,pendingCount:0,candidates:[]});
 assert.deepEqual(await f.client.recover(otherAccount),{verified:0,pending:0,failed:0});assert.equal(await f.client.prepare(quote),false);
});

test("interruption survives process restart and is cleared only by same-account clean recovery",async()=>{
 const f=fixture();assert.equal(await f.client.prepare(quote),true);assert.equal(await f.client.launch(),"launched");
 const raw=await f.storage.read();assert.deepEqual(JSON.parse(raw),{version:1,owner,accountId,environment:"test"});assert.doesNotMatch(raw,/fixture-session|synthetic-purchase-token/);
 const restarted=createPlayPurchaseCoordinator({...f.deps,journal:createPlayRecoveryJournal(f.storage)});restarted.setOwner(owner);
 assert.equal(await restarted.prepare(quote),false);
 f.deps.restore=async()=>({accountId,pendingCount:0,candidates:[]});
 const next=createPlayPurchaseCoordinator({...f.deps,journal:createPlayRecoveryJournal(f.storage)});next.setOwner(owner);
 assert.deepEqual(await next.recover(accountId),{verified:0,pending:0,failed:0});assert.equal(await f.storage.read(),null);assert.equal(await next.prepare(quote),true);
});
test("corrupt or unavailable secure storage blocks launch, never silently erases evidence",async()=>{
 const f=fixture();await f.storage.write('{"foreign":"record"}');assert.equal(await f.client.prepare(quote),false);assert.equal(await f.storage.read(),'{"foreign":"record"}');
 const g=fixture();assert.equal(await g.client.prepare(quote),true);g.storage.write=async()=>{throw Error("keystore unavailable");};assert.equal(await g.client.launch(),"held");assert.deepEqual(g.calls,[]);
});
