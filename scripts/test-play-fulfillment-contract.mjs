import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const load=(path,requires={})=>{const exports={};new Function("exports","require",ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,key=>{if(Object.hasOwn(requires,key))return requires[key];throw Error("Unexpected import");});return exports;};
const products=load("../lib/billing/play-products.ts");
const {reconcileTestPurchase}=load("../lib/server/play/test-fulfillment.ts",{"server-only":{},"../../billing/play-products":products});
const now=Date.parse("2026-11-28T00:00:00Z"),expiresAt="2026-12-28T00:00:00Z";
const owner="11111111-1111-4111-8111-111111111111",token="synthetic-purchase-token";
const input={owner,role:"player",productId:"hoopcheck.pro",basePlanId:"monthly",token};
const product=products.playProduct(input.productId,input.basePlanId);
function fixture(){
 const calls=[],sealed={version:1,fingerprint:"a".repeat(64),envelope:"synthetic-ciphertext"};
 const receipt={scope:"test",owner,fingerprint:sealed.fingerprint,productId:input.productId,basePlanId:input.basePlanId,generation:1,expiresAt,committed:true};
 let acknowledged=false;
 const deps={now:()=>now,authorize:async()=>true,verify:async()=>{calls.push("verify");return {state:acknowledged?"eligible_for_reconciliation":"pending_ack",product,expiresAt};},seal:()=>sealed,claim:async()=>{calls.push("claim");return "claimed";},fulfillTest:async()=>{calls.push("fulfill");return receipt;},confirmFulfillment:async()=>{calls.push("confirm");return true;},acknowledgeTest:async()=>{calls.push("ack");acknowledged=true;return true;},reconcileTest:async()=>{calls.push("reconcile");return true;}};
 return {calls,deps,receipt};
}
test("test fulfillment precedes acknowledgement and post-ack provider confirmation",async()=>{
 const f=fixture();assert.equal(await reconcileTestPurchase(input,f.deps),"test_fulfillment_confirmed");assert.ok(f.calls.indexOf("fulfill")<f.calls.indexOf("ack"));assert.ok(f.calls.lastIndexOf("verify")>f.calls.indexOf("ack"));assert.equal(f.calls.at(-1),"reconcile");
});
test("foreign owner, pending ledger, invalid receipt and account denial never acknowledge",async()=>{
 for(const patch of [d=>d.claim=async()=>"foreign_owner",d=>d.fulfillTest=async()=>null,d=>d.fulfillTest=async()=>({...fixture().receipt,owner:"foreign"}),d=>d.confirmFulfillment=async()=>false,d=>d.authorize=async()=>false]){
  const f=fixture();patch(f.deps);assert.notEqual(await reconcileTestPurchase(input,f.deps),"test_fulfillment_confirmed");assert.ok(!f.calls.includes("ack"));
 }
 const f=fixture();assert.equal(await reconcileTestPurchase({...input,role:"fan"},f.deps),"held");assert.equal(f.calls.length,0);
});
test("provider changes or acknowledgment failures do not report fulfillment confirmed",async()=>{
 const f=fixture();let n=0;f.deps.verify=async()=>({state:++n===1?"pending_ack":"inactive",product,expiresAt});assert.equal(await reconcileTestPurchase(input,f.deps),"pending_reconciliation");assert.ok(!f.calls.includes("ack"));
 const g=fixture();g.deps.acknowledgeTest=async()=>false;assert.equal(await reconcileTestPurchase(input,g.deps),"pending_acknowledgment");assert.ok(!g.calls.includes("reconcile"));
 const h=fixture();h.deps.verify=async()=>({state:"pending_ack",product,expiresAt});assert.equal(await reconcileTestPurchase(input,h.deps),"pending_reconciliation");assert.ok(!h.calls.includes("reconcile"));
});
test("already acknowledged provider response skips repeated acknowledgment",async()=>{
 const f=fixture();f.deps.verify=async()=>({state:"eligible_for_reconciliation",product,expiresAt});f.deps.claim=async()=>"already_claimed";assert.equal(await reconcileTestPurchase(input,f.deps),"test_fulfillment_confirmed");assert.ok(!f.calls.includes("ack"));
});
