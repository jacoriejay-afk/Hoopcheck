import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const load=(path,requires={})=>{const exports={};new Function("exports","require",ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,key=>{if(Object.hasOwn(requires,key))return requires[key];throw Error("Unexpected import");});return exports;};
const products=load("../lib/billing/play-products.ts"),requires={"server-only":{},"../../billing/play-products":products};
const {acknowledgeTestPurchase}=load("../lib/server/play/acknowledgment.ts",requires);
const {parseAuthenticatedPlayNotification}=load("../lib/server/play/rtdn.ts",requires);
const token="synthetic-purchase-token",owner="11111111-1111-4111-8111-111111111111",now=Date.parse("2026-11-28T00:00:00Z"),expiresAt="2026-12-28T00:00:00Z",fingerprint="a".repeat(64);
const receipt={owner,fingerprint,productId:"hoopcheck.pro",basePlanId:"monthly",expiresAt,generation:1,scope:"test",committed:true};
function fixture(){
 const calls=[];
 const ports={now:()=>now,fingerprint:()=>fingerprint,confirmDurableFulfillment:async()=>true,verify:async()=>({state:"pending_ack",product:products.playProduct(receipt.productId,receipt.basePlanId),expiresAt}),accessToken:async()=>"synthetic-access",request:async(url,init)=>{calls.push({url,init});return new Response(null,{status:204});}};
 return {calls,ports};
}
test("acknowledgment sends exact bounded provider request only after confirmed fulfillment",async()=>{
 const f=fixture();assert.equal(await acknowledgeTestPurchase(receipt,token,f.ports),"reverify_required");
 assert.equal(f.calls.length,1);const {url,init}=f.calls[0];assert.equal(url,"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/online.hoopcheck.app/purchases/subscriptions/hoopcheck.pro/tokens/"+token+":acknowledge");assert.equal(init.method,"POST");assert.equal(init.redirect,"error");assert.equal(init.body,"{}");
});
test("foreign fingerprint, missing receipt, unverified purchase, changed fulfillment and already acknowledged never POST",async()=>{
 for(const mutate of [f=>f.ports.fingerprint=()=>"b".repeat(64),f=>f.ports.confirmDurableFulfillment=async()=>false,f=>f.ports.verify=async()=>({state:"inactive"}),f=>{let n=0;f.ports.confirmDurableFulfillment=async()=>++n===1;}]){
  const f=fixture();mutate(f);assert.equal(await acknowledgeTestPurchase(receipt,token,f.ports),"held");assert.equal(f.calls.length,0);
 }
 const f=fixture();f.ports.verify=async()=>({state:"eligible_for_reconciliation",product:products.playProduct(receipt.productId,receipt.basePlanId),expiresAt});assert.equal(await acknowledgeTestPurchase(receipt,token,f.ports),"already_acknowledged");assert.equal(f.calls.length,0);
});
test("provider failure or thrown transport errors return generic unavailable",async()=>{
 for(const request of [async()=>new Response(token,{status:403}),async()=>{throw Error(token);}]){const f=fixture();f.ports.request=request;assert.equal(await acknowledgeTestPurchase(receipt,token,f.ports),"unavailable");}
});
const sub="projects/fixture-project/subscriptions/fixture-play";
const message=(payload,subscription=sub)=>({subscription,message:{messageId:"123456",data:Buffer.from(JSON.stringify(payload)).toString("base64")}});
const common={version:"1.0",packageName:"online.hoopcheck.app",eventTimeMillis:String(now)};
const subscription={...common,subscriptionNotification:{version:"1.0",notificationType:2,purchaseToken:token}};
test("subscription and voided events only request fresh verification; test event is not access",()=>{
 assert.deepEqual(parseAuthenticatedPlayNotification(message(subscription),sub,now),{kind:"refresh",messageId:"123456",eventTimeMillis:now,token});
 assert.equal(parseAuthenticatedPlayNotification(message({...common,voidedPurchaseNotification:{productType:1,purchaseToken:token}}),sub,now).kind,"refresh");
 assert.equal(parseAuthenticatedPlayNotification(message({...common,testNotification:{version:"1.0"}}),sub,now).kind,"test");
 assert.equal(parseAuthenticatedPlayNotification(message({...common,oneTimeProductNotification:{version:"1.0"}}),sub,now).kind,"unsupported");
});
test("wrong subscription/package, ambiguous event, malformed token, invalid timestamp and oversized messages rejected",()=>{
 for(const value of [message(subscription,"projects/other-project/subscriptions/other"),message({...subscription,packageName:"foreign"}),message({...subscription,testNotification:{version:"1.0"}}),message({...subscription,eventTimeMillis:String(now+600000)}),message({...subscription,subscriptionNotification:{version:"1.0",notificationType:2,purchaseToken:"../invalid"}}),{subscription:sub,message:{messageId:"123",data:"A".repeat(32769)}}])assert.throws(()=>parseAuthenticatedPlayNotification(value,sub,now),{message:"Google Play notification could not be verified."});
});
