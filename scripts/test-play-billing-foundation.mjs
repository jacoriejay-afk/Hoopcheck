import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
function load(path,requires={}){const exports={};const code=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function("exports","require",code)(exports,key=>{if(!Object.hasOwn(requires,key))throw Error("Unexpected import");return requires[key];});return exports;}
const products=load("../lib/billing/play-products.ts");
const {classifyPlaySubscription:classify}=load("../lib/billing/play-subscription.ts",{"./play-products":products});
const owner="a".repeat(64),now=Date.parse("2026-11-28T00:00:00Z");
const fixture=()=>({externalAccountIdentifiers:{obfuscatedExternalAccountId:owner},testPurchase:{},subscriptionState:"SUBSCRIPTION_STATE_ACTIVE",acknowledgementState:"ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",lineItems:[{productId:"hoopcheck.pro",offerDetails:{basePlanId:"monthly"},autoRenewingPlan:{autoRenewEnabled:true},expiryTime:"2026-12-28T00:00:00Z"}]});
test("six proposed plans match approved reference amounts, with role boundaries",()=>{
 assert.deepEqual(products.PLAY_PRODUCTS.map(p=>p.usdMinor),[499,2695,5090,999,5395,10190]);
 for(const p of products.PLAY_PRODUCTS){assert.equal(products.playProduct(p.productId,p.basePlanId),p);assert.equal(products.canPurchasePlayProduct("player",p),true);assert.equal(products.canPurchasePlayProduct("fan",p),false);assert.equal(products.canPurchasePlayProduct("manager",p),p.plan==="premium");assert.equal(products.canPurchasePlayProduct("coach",p),p.plan==="premium");for(const role of ["scout","agent","club_admin"])assert.equal(products.canPurchasePlayProduct(role,p),true);}
 assert.equal(products.playProduct("unknown","monthly"),null);
});
test("trusted current state can be considered for reconciliation, not granted directly",()=>{
 for(const state of ["ACTIVE","IN_GRACE_PERIOD","CANCELED"]){const v=fixture();v.subscriptionState="SUBSCRIPTION_STATE_"+state;assert.equal(classify(v,owner,"test",now).state,"eligible_for_reconciliation");}
 const v=fixture();v.acknowledgementState="ACKNOWLEDGEMENT_STATE_PENDING";assert.equal(classify(v,owner,"test",now).state,"pending_ack");
});
test("expired, pending, revoked or held access never becomes eligible",()=>{
 for(const state of ["PENDING","PAUSED","ON_HOLD","EXPIRED","PENDING_PURCHASE_CANCELED","UNKNOWN"]){const v=fixture();v.subscriptionState="SUBSCRIPTION_STATE_"+state;assert.equal(classify(v,owner,"test",now).state,"inactive");}
 const v=fixture();v.lineItems[0].expiryTime="2026-11-28T00:00:00Z";assert.equal(classify(v,owner,"test",now).state,"inactive");
});
test("account mismatch, test/production separation and invalid responses fail closed",()=>{
 assert.equal(classify(fixture(),"b".repeat(64),"test",now).state,"invalid");
 assert.equal(classify(fixture(),owner,"production",now).state,"invalid");
 const v=fixture();delete v.testPurchase;assert.equal(classify(v,owner,"test",now).state,"invalid");assert.equal(classify(v,owner,"production",now).state,"eligible_for_reconciliation");
 for(const mutate of [v=>v.lineItems[0].expiryTime="2026-02-31T00:00:00Z",v=>v.lineItems[0].productId="unknown",v=>v.acknowledgementState="UNKNOWN"]){const x=fixture();mutate(x);assert.equal(classify(x,owner,"test",now).state,"invalid");}
});
test("offers and replacement chains are blocked until lifecycle persistence is implemented",()=>{
 for(const mutate of [v=>v.linkedPurchaseToken="fixture",v=>v.lineItems.push(v.lineItems[0]),v=>v.lineItems[0].offerDetails.offerId="trial",v=>{delete v.lineItems[0].autoRenewingPlan;v.lineItems[0].prepaidPlan={};}]){const v=fixture();mutate(v);assert.equal(classify(v,owner,"test",now).state,"unsupported");}
});

test("linked runtime evidence is separately scoped and cannot bypass account or catalog validation",()=>{
 const {classifyPlayRuntimeSubscription:runtime}=load("../lib/billing/play-subscription.ts",{"./play-products":products});
 const token="synthetic-successor-token",old="synthetic-predecessor-token",hash=t=>t===old?"b".repeat(64):"c".repeat(64);
 const v=fixture();v.linkedPurchaseToken=old;
 assert.equal(runtime(v,owner,token,hash,now).previousFingerprint,"b".repeat(64));
 assert.equal(runtime(v,"d".repeat(64),token,hash,now).state,"invalid");
 v.linkedPurchaseToken=token;assert.equal(runtime(v,owner,token,hash,now).state,"unsupported");
 v.linkedPurchaseToken=old;delete v.testPurchase;assert.equal(runtime(v,owner,token,hash,now).state,"invalid");
});
