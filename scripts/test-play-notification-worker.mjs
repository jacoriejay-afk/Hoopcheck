import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const load=(path,requires={})=>{const e={};new Function("exports","require",ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e,k=>{if(Object.hasOwn(requires,k))return requires[k];throw Error("unexpected");});return e;};
const products=load("../lib/billing/play-products.ts"),requires={"server-only":{},"../../billing/play-products":products};
const rtdn=load("../lib/server/play/rtdn.ts",requires);
const {ingestPlayPush,reconcileOnePlayNotification}=load("../lib/server/play/notification-worker.ts",{...requires,"./rtdn":rtdn});
const fp="a".repeat(64),token="synthetic-purchase-token",now=Date.parse("2026-11-28T00:00:00Z"),sub="projects/fixture-project/subscriptions/fixture-play";
const body={subscription:sub,message:{messageId:"123",data:Buffer.from(JSON.stringify({version:"1.0",packageName:"online.hoopcheck.app",eventTimeMillis:String(now),subscriptionNotification:{version:"1.0",notificationType:2,purchaseToken:token}})).toString("base64")}};
test("authenticate before durable enqueue; only fingerprint stored and failure retried",async()=>{
 const calls=[],ports={enabled:()=>true,authenticate:async()=>{calls.push("auth");},subscription:sub,fingerprint:()=>fp,enqueue:async(...args)=>{calls.push(args);return "queued";},now:()=>now};
 assert.equal(await ingestPlayPush(body,"fixture",ports),"accepted");assert.deepEqual(calls,["auth",[sub,"123",fp]]);
 ports.enqueue=async()=>"conflict";assert.equal(await ingestPlayPush(body,"fixture",ports),"retry");
 ports.authenticate=async()=>{throw Error("denied");};ports.enqueue=async()=>{throw Error("must not run");};assert.equal(await ingestPlayPush(body,"fixture",ports),"retry");
});
function fixture(){
 const calls=[],claim={owner:"11111111-1111-4111-8111-111111111111",fingerprint:fp,productId:"hoopcheck.pro",basePlanId:"monthly"};
 const job={subscription:sub,messageId:"123",fingerprint:fp,leaseId:"fixture-lease"};
 const ports={enabled:()=>true,lease:async()=>job,lookup:async()=>claim,open:async()=>token,fingerprint:()=>fp,begin:async()=>1,verify:async()=>({state:"inactive"}),complete:async(...args)=>{calls.push(args.slice(1));return true;},finish:async(j,success)=>{calls.push(success);return true;},now:()=>now};
 return {calls,ports};
}
test("worker commits fresh inactive observation before completing lease",async()=>{const f=fixture();assert.equal(await reconcileOnePlayNotification(f.ports),"done");assert.deepEqual(f.calls,[[1,"inactive",null],true]);});
test("unknown claim and unavailable verification retry; stale generation cannot complete",async()=>{
 const f=fixture();f.ports.lookup=async()=>null;assert.equal(await reconcileOnePlayNotification(f.ports),"retry");assert.deepEqual(f.calls,[false]);
 const g=fixture();g.ports.verify=async()=>({state:"invalid"});assert.equal(await reconcileOnePlayNotification(g.ports),"retry");assert.deepEqual(g.calls,[[1,"unavailable",null],false]);
 const h=fixture();h.ports.complete=async()=>false;assert.equal(await reconcileOnePlayNotification(h.ports),"retry");assert.deepEqual(h.calls,[false]);
});

test("verified cancellation metadata travels with generation fenced completion",async()=>{
 const f=fixture(),meta={providerState:"SUBSCRIPTION_STATE_CANCELED",autoRenewEnabled:false,periodEnd:"2026-12-28T00:00:00Z"};
 f.ports.verify=async()=>({state:"eligible_for_reconciliation",product:{productId:"hoopcheck.pro",basePlanId:"monthly"},expiresAt:meta.periodEnd,lifecycle:meta});
 assert.equal(await reconcileOnePlayNotification(f.ports),"done");
 assert.deepEqual(f.calls,[[1,"eligible_for_reconciliation",meta.periodEnd,meta],true]);
});
