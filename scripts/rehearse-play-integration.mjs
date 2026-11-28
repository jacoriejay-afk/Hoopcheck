// Disposable CI integration only. No hosted DB, no real Google requests.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import * as crypto from "node:crypto";
import ts from "typescript";
const container=process.env.PG_CONTAINER;
if(process.env.HOOPCHECK_PLAY_DISPOSABLE_REHEARSAL!=="true"||process.env.GITHUB_ACTIONS!=="true"||!container||! /^[a-f0-9]{64}$/.test(container))throw Error("Disposable CI database required");
const load=(path,requires={})=>{const e={};new Function("exports","require",ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e,k=>{if(Object.hasOwn(requires,k))return requires[k];throw Error("unexpected import");});return e;};
const products=load("../lib/billing/play-products.ts");
const base={"server-only":{},"node:crypto":crypto,"../../billing/play-products":products};
const classifier=load("../lib/billing/play-subscription.ts",{"./play-products":products});
const {createPlayVerificationClient}=load("../lib/server/play/verification.ts",{...base,"../../billing/play-subscription":classifier});
const {createPlayTokenVault}=load("../lib/server/play/token-vault.ts",base);
const {reconcileTestPurchase}=load("../lib/server/play/test-fulfillment.ts",base);
const {acknowledgeTestPurchase}=load("../lib/server/play/acknowledgment.ts",base);
const rtdn=load("../lib/server/play/rtdn.ts",base);
const {ingestPlayPush,reconcileOnePlayNotification}=load("../lib/server/play/notification-worker.ts",{...base,"./rtdn":rtdn});
const {authenticatePlayPush}=load("../lib/server/play/push-auth.ts",base);
// All SQL input is generated fixture data; strict literal escaping and no
// raw purchase token in SQL, arguments or logs.
const q=v=>{if(typeof v!=="string"||! /^[A-Za-z0-9._:~+\/-]{1,5600}$/.test(v))throw Error("invalid fixture literal");return "'"+v+"'";};
const integer=v=>{if(!Number.isSafeInteger(v)||v<=0)throw Error("invalid fixture generation");return String(v);};
function sql(statement){
 const result=spawnSync("docker",["exec","-i",container,"psql","-XqAt","-U","postgres","-v","ON_ERROR_STOP=1"],{input:"set role service_role;\n"+statement+";\n",encoding:"utf8",timeout:15000,maxBuffer:262144});
 if(result.status!==0||result.error)throw Error("Disposable database operation failed");
 return result.stdout.trim();
}
const owner="66666666-6666-4666-8666-666666666666",foreign="77777777-7777-4777-8777-777777777777",session="88888888-8888-4888-8888-888888888888";
const token="synthetic-e2e-"+crypto.randomBytes(16).toString("hex");
const product=products.playProduct("hoopcheck.premium","annual");
const vault=createPlayTokenVault("ab".repeat(32),"cd".repeat(32));
const fp=vault.fingerprint(token,"test"),expiry=new Date(Date.now()+86400000).toISOString();
const {privateKey,publicKey}=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
const env={HOOPCHECK_PLAY_VERIFICATION_ENABLED:"true",HOOPCHECK_PLAY_ENVIRONMENT:"test",NEXT_PUBLIC_SUPABASE_URL:"https://fixture.supabase.co",HOOPCHECK_PLAY_ISOLATED_SUPABASE_URL:"https://fixture.supabase.co",HOOPCHECK_PLAY_SERVICE_ACCOUNT_EMAIL:"fixture@fixture.iam.gserviceaccount.com",HOOPCHECK_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY:privateKey.export({format:"pem",type:"pkcs8"}).toString(),HOOPCHECK_PLAY_ACCOUNT_HMAC_KEY:"ef".repeat(32)};
let acknowledged=false,revoked=false,ackCount=0,client;
const json=value=>new Response(JSON.stringify(value));
const fakeRequest=async(url,init)=>{
 if(url==="https://oauth2.googleapis.com/token"&&init.method==="POST")return json({access_token:"fixture-oauth",token_type:"Bearer",expires_in:3600});
 if(url==="https://androidpublisher.googleapis.com/androidpublisher/v3/applications/online.hoopcheck.app/purchases/subscriptionsv2/tokens/"+token&&init.method==="GET"){
  assert.equal(init.headers.Authorization,"Bearer fixture-oauth");
  return json({externalAccountIdentifiers:{obfuscatedExternalAccountId:client.accountId(owner)},testPurchase:{},subscriptionState:revoked?"SUBSCRIPTION_STATE_EXPIRED":"SUBSCRIPTION_STATE_ACTIVE",acknowledgementState:acknowledged?"ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED":"ACKNOWLEDGEMENT_STATE_PENDING",lineItems:[{productId:product.productId,offerDetails:{basePlanId:product.basePlanId},autoRenewingPlan:{autoRenewEnabled:true},expiryTime:expiry}]});
 }
 if(url==="https://androidpublisher.googleapis.com/androidpublisher/v3/applications/online.hoopcheck.app/purchases/subscriptions/"+product.productId+"/tokens/"+token+":acknowledge"&&init.method==="POST"){
  assert.equal(init.headers.Authorization,"Bearer fixture-oauth");assert.equal(sql("select count(*) from play_billing_candidate.test_fulfillments where fingerprint="+q(fp)),"1");
  assert.equal(sql("select count(*) from play_billing_candidate.shadow_play_sources where source_id="+q(fp)),"0");
  acknowledged=true;ackCount++;return new Response(null,{status:204});
 }
 throw Error("Unexpected synthetic provider request");
};
client=createPlayVerificationClient(env,fakeRequest);
const account=client.accountId(owner);
const quote=[q(owner),q(session),q(account),q(product.productId),q(product.basePlanId),q("101900000"),q("USD")].join(",");
const intent=sql("select play_billing_candidate.issue_test_intent("+quote+")");
assert.equal(sql("select play_billing_candidate.consume_test_intent("+q(intent)+","+quote+")"),"t");
assert.equal(sql("select play_billing_candidate.consume_test_intent("+q(intent)+","+quote+")"),"f");
const claimArgs=(owner,sealed)=>[q(sealed.fingerprint),q(owner),"1::smallint",q(sealed.envelope),q(product.productId),q(product.basePlanId)].join(",");
const args=(owner,g,expires)=>[q(fp),q(owner),integer(g),q(expires)].join(",");
const begin=owner=>Number(sql("select play_billing_candidate.begin_test_refresh("+q(fp)+","+q(owner)+")"));
const finish=(owner,g,state,expires)=>sql("select play_billing_candidate.finish_test_refresh("+[q(fp),q(owner),integer(g),q(state),expires===null?"null":q(expires)].join(",")+")")==="t";
const commit=(owner,g,expires)=>sql("select play_billing_candidate.commit_test_fulfillment("+args(owner,g,expires)+")")==="t";
const confirm=receipt=>sql("select play_billing_candidate.confirm_test_fulfillment("+args(receipt.owner,receipt.generation,receipt.expiresAt)+")")==="t";
let allowed=true;
const deps={
 now:Date.now,authorize:async input=>allowed&&input.owner===owner&&input.role==="player",
 verify:(o,t)=>client.verify(o,t),
 seal:(t,o)=>vault.seal(t,o,"test"),
 claim:async(o,p,s)=>sql("select play_billing_candidate.claim_test_purchase("+claimArgs(o,s)+")"),
 fulfillTest:async(o,p,s,expires)=>{
  const g=begin(o),v=await client.verify(o,token);
  if(!finish(o,g,v.state,expires)||!commit(o,g,expires))return null;
  return {scope:"test",owner:o,fingerprint:s.fingerprint,productId:p.productId,basePlanId:p.basePlanId,generation:g,expiresAt:expires,committed:true};
 },
 confirmFulfillment:async receipt=>confirm(receipt),
 acknowledgeTest:async(receipt,t)=>(await acknowledgeTestPurchase(receipt,t,{verify:(o,x)=>client.verify(o,x),fingerprint:x=>vault.fingerprint(x,"test"),confirmDurableFulfillment:async r=>confirm(r),accessToken:async()=>"fixture-oauth",request:fakeRequest,now:Date.now}))==="reverify_required",
 reconcileTest:async(receipt,v)=>{const g=begin(receipt.owner);return finish(receipt.owner,g,v.state,v.expiresAt)&&commit(receipt.owner,g,v.expiresAt);},
};
const input={owner,role:"player",productId:product.productId,basePlanId:product.basePlanId,token};
assert.equal(await reconcileTestPurchase(input,deps),"test_fulfillment_confirmed");
assert.equal(ackCount,1);
assert.equal(sql("select provider||':'||plan from play_billing_candidate.shadow_membership_entitlements where user_id="+q(owner)),"google_play_test:premium");
assert.equal(sql("select count(*) from public.membership_sources where user_id="+q(owner)),"0");
assert.equal(await reconcileTestPurchase(input,deps),"test_fulfillment_confirmed");
assert.equal(ackCount,1);
assert.equal(sql("select play_billing_candidate.claim_test_purchase("+claimArgs(foreign,vault.seal(token,foreign,"test"))+")"),"foreign_owner");
allowed=false;assert.equal(await reconcileTestPurchase(input,deps),"held");assert.equal(ackCount,1);
// Signed synthetic push -> actual durable queue -> actual generation-fenced
// observation -> revoked shadow access; Google provider is still mocked.
const sub="projects/fixture-project/subscriptions/fixture-play";
const config={audience:"https://fixture.invalid/play/push",email:env.HOOPCHECK_PLAY_SERVICE_ACCOUNT_EMAIL,subject:"123456789"};
const now=Date.now(),sec=Math.floor(now/1000),b64=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
const unsigned=b64({alg:"RS256",kid:"fixture"})+"."+b64({iss:"https://accounts.google.com",aud:config.audience,email:config.email,email_verified:true,sub:config.subject,iat:sec-1,exp:sec+3590});
const auth="Bearer "+unsigned+"."+crypto.sign("RSA-SHA256",Buffer.from(unsigned),privateKey).toString("base64url");
const keyRequest=async(url,init)=>{assert.equal(url,"https://www.googleapis.com/oauth2/v3/certs");assert.equal(init.method,"GET");return json({keys:[{...publicKey.export({format:"jwk"}),kid:"fixture",alg:"RS256",use:"sig"}]});};
const event={subscription:sub,message:{messageId:"987654321",data:Buffer.from(JSON.stringify({version:"1.0",packageName:"online.hoopcheck.app",eventTimeMillis:String(now),subscriptionNotification:{version:"1.0",notificationType:13,purchaseToken:token}})).toString("base64")}};
const ingress={enabled:()=>true,authenticate:a=>authenticatePlayPush(a,config,keyRequest,now),subscription:sub,fingerprint:t=>vault.fingerprint(t,"test"),enqueue:async(s,m,f)=>sql("select play_billing_candidate.enqueue_test_notification("+[q(s),q(m),q(f)].join(",")+")"),now:()=>now};
assert.equal(await ingestPlayPush(event,auth,ingress),"accepted");assert.equal(await ingestPlayPush(event,auth,ingress),"accepted");
assert.equal(sql("select count(*) from play_billing_candidate.notification_jobs where message_id='987654321'"),"1");
revoked=true;
const row=sql("select row_to_json(x) from play_billing_candidate.lease_test_notification() x");
const job=JSON.parse(row);
const ports={enabled:()=>true,lease:async()=>({subscription:job.subscription,messageId:job.message_id,fingerprint:job.fingerprint,leaseId:job.lease_id}),
 lookup:async f=>{const v=JSON.parse(sql("select row_to_json(x) from (select owner_id,product_id,base_plan_id,fingerprint from play_billing_candidate.purchase_claims where fingerprint="+q(f)+") x"));return {owner:v.owner_id,productId:v.product_id,basePlanId:v.base_plan_id,fingerprint:v.fingerprint};},
 open:async c=>{const v=JSON.parse(sql("select row_to_json(x) from (select credential_version,credential_envelope,fingerprint from play_billing_candidate.purchase_claims where fingerprint="+q(c.fingerprint)+") x"));return vault.open({version:v.credential_version,envelope:v.credential_envelope,fingerprint:v.fingerprint},c.owner,"test");},
 fingerprint:t=>vault.fingerprint(t,"test"),begin:async c=>begin(c.owner),verify:(o,t)=>client.verify(o,t),complete:async(c,g,state,expires)=>finish(c.owner,g,state,expires),
 finish:async(j,success)=>sql("select play_billing_candidate.finish_test_notification("+[q(j.subscription),q(j.messageId),q(j.leaseId),success?"true":"false"].join(",")+")")==="t",now:Date.now};
assert.equal(await reconcileOnePlayNotification(ports),"done");
assert.equal(sql("select play_billing_candidate.read_test_observation("+q(fp)+","+q(owner)+")"),"inactive");
assert.equal(sql("select count(*) from play_billing_candidate.shadow_membership_entitlements where user_id="+q(owner)),"0");
assert.equal(sql("select count(*) from public.membership_sources where user_id="+q(owner)),"0");
assert.equal(sql("select status from play_billing_candidate.notification_jobs where message_id='987654321'"),"done");
console.log("End-to-end synthetic Google Play integration passed: intent, encrypted ownership, provider verification, durable fulfillment, simulated acknowledgment, shadow membership, authenticated notification, dedupe and revocation.");
