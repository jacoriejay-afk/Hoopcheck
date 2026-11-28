import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const load=(p,requires={})=>{const e={};new Function("exports","require",ts.transpileModule(readFileSync(new URL(p,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e,k=>{if(Object.hasOwn(requires,k))return requires[k];throw Error("Unexpected import");});return e;};
const products=load("../lib/billing/play-products.ts");
const {verifyPlayRequest}=load("../lib/server/play/verify-request.ts",{"server-only":{},"../../billing/play-products":products});
const owner="11111111-1111-4111-8111-111111111111",now=Date.parse("2026-11-28T00:00:00Z");
const input={productId:"hoopcheck.pro",basePlanId:"monthly",purchaseToken:"fixture-purchase-token"};
const request=(body=input)=>new Request("https://fixture.invalid/api/mobile/play/purchases/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
function fixture(){const calls=[];return {calls,ports:{enabled:()=>true,authorize:async()=>({owner,role:"player"}),takeBudget:async()=>true,verify:async(o,t)=>{calls.push([o,t]);return {state:"eligible_for_reconciliation",product:products.playProduct(input.productId,input.basePlanId),expiresAt:"2026-12-28T00:00:00Z"};},now:()=>now}};}
test("verified request is owner-bound, read-only, no-store and returns no token or entitlement",async()=>{
 const f=fixture(),r=await verifyPlayRequest(request(),f.ports);assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"private, no-store");assert.deepEqual(await r.json(),{owner,environment:"test",outcome:"verified_observation",membershipGranted:false});assert.deepEqual(f.calls,[[owner,input.purchaseToken]]);
});
test("disabled, unauthorized, role denied, foreign owner field and invalid token never verify",async()=>{
 for(const [change,body,status] of [[f=>f.ports.enabled=()=>false,input,503],[f=>f.ports.authorize=async()=>null,input,401],[f=>f.ports.authorize=async()=>({owner,role:"fan"}),input,403],[()=>{}, {...input,owner},400],[()=>{}, {...input,purchaseToken:"../invalid"},400],[()=>{}, {...input,purchaseToken:"x".repeat(9000)},400]]){
  const f=fixture();change(f);assert.equal((await verifyPlayRequest(request(body),f.ports)).status,status);assert.deepEqual(f.calls,[]);
 }
});
test("session changed while verifying and provider mismatch fail closed",async()=>{
 const f=fixture();let n=0;f.ports.authorize=async()=>++n===1?{owner,role:"player"}:null;assert.equal((await verifyPlayRequest(request(),f.ports)).status,503);
 const g=fixture();g.ports.verify=async()=>({state:"invalid",token:input.purchaseToken});const reply=await (await verifyPlayRequest(request(),g.ports)).json();assert.equal(reply.outcome,"not_verified");assert.equal(reply.membershipGranted,false);assert.doesNotMatch(JSON.stringify(reply),/fixture-purchase-token/);
});
test("actual route uses independent isolated gate and existing Auth/MFA/session checks",()=>{
 const route=readFileSync(new URL("../app/api/mobile/play/purchases/verify/route.ts",import.meta.url),"utf8");
 assert.match(route,/HOOPCHECK_PLAY_TEST_API_ENABLED==="true"&&validPlaySandbox/);assert.match(route,/appleRequest\(req\)/);assert.match(route,/account_deletion_requests/);assert.doesNotMatch(route,/acknowledgeTestPurchase|\.insert\(|\.update\(|\.delete\(/g);
});

test("exhausted or unavailable durable verification budget prevents provider calls",async()=>{const f=fixture();f.ports.takeBudget=async()=>false;assert.equal((await verifyPlayRequest(request(),f.ports)).status,429);assert.deepEqual(f.calls,[]);const g=fixture();g.ports.takeBudget=async()=>{throw Error("db unavailable");};assert.equal((await verifyPlayRequest(request(),g.ports)).status,503);assert.deepEqual(g.calls,[]);});
