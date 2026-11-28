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
const {playIntentRequest}=load("../lib/server/play/intent-request.ts",base);
const {createDisposablePlayAdapters}=load("../lib/server/play/disposable-adapters.ts",base);
const {createDisposablePlayRuntime}=load("../lib/server/play/disposable-runtime.ts",{...base,"./intent-request":{playIntentRequest},"./test-fulfillment":{reconcileTestPurchase}});
const coordinator=load("../apps/mobile/src/native/playPurchaseCoordinator.ts",{"../../../../lib/billing/play-products":products});
const {createPlayRecoveryJournal}=load("../apps/mobile/src/native/playRecoveryJournal.ts");
const {createPlaySandboxBridge}=load("../apps/mobile/src/native/playSandboxBridge.ts",{"./playPurchaseCoordinator":coordinator});
// All SQL input is generated fixture data; strict literal escaping and no
// raw purchase token in SQL, arguments or logs.
const q=v=>{if(typeof v!=="string"||! /^[A-Za-z0-9._:~+\/-]{1,5600}$/.test(v))throw Error("invalid fixture literal");return "'"+v+"'";};
const integer=v=>{if(!Number.isSafeInteger(v)||v<=0)throw Error("invalid fixture generation");return String(v);};
function sql(statement){
 const result=spawnSync("docker",["exec","-i",container,"psql","-XqAt","-U","postgres","-v","ON_ERROR_STOP=1"],{input:"set role service_role;\n"+statement+";\n",encoding:"utf8",timeout:15000,maxBuffer:262144});
 if(result.status!==0||result.error){const kind=result.stderr?.match(/ERROR:\s*(permission denied|violates|column|function|relation|syntax error|candidate owner unavailable|duplicate key|deadlock detected)/i)?.[1]??"unknown";console.error("Disposable SQL failed:",kind);throw Error("Disposable database operation failed");}
 return result.stdout.trim();
}
// CI driver only: fixed statements, strictly escaped generated synthetic parameters.
const adapter=createDisposablePlayAdapters({scope:"disposable_pg17",enabled:()=>true,query:async(statement,parameters)=>{
 const rendered=statement.replace(/\$(\d+)/g,(_,n)=>{const v=parameters[Number(n)-1];if(v===null)return "null";if(typeof v==="number")return integer(v);if(typeof v==="boolean")return String(v);return q(v);});
 const v=sql(rendered);if(!v)return null;if(v==="t"||v==="f")return v==="t";if(/^\d+$/.test(v))return Number(v);if(v.startsWith("{"))return JSON.parse(v);return v;
}});
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
const localized={productId:product.productId,basePlanId:product.basePlanId,priceMicros:"101900000",currency:"USD"};
const req=(b,t="synthetic-session")=>new Request("https://fixture.invalid/intent",{method:"POST",headers:{"Content-Type":"application/json",authorization:"Bearer "+t},body:JSON.stringify(b)});
const intentPorts={enabled:()=>true,authorize:async()=>({owner,sessionId:session,role:"player"}),accountId:o=>client.accountId(o),quote:async()=>({...localized,environment:"test",expiresAt:Date.now()+30000}),issue:adapter.issue,consume:adapter.consume,now:Date.now};
const issued=await playIntentRequest(req(localized),"issue",intentPorts);assert.equal(issued.status,200);
const intent=await issued.json();
const consume={...localized,intentId:intent.intentId,expiresAt:intent.expiresAt};
assert.equal((await playIntentRequest(req({...consume,expiresAt:consume.expiresAt-1}),"consume",intentPorts)).status,409);
assert.equal((await playIntentRequest(req(consume),"consume",intentPorts)).status,200);
assert.equal((await playIntentRequest(req(consume),"consume",intentPorts)).status,409);
const claimArgs=(owner,sealed)=>[q(sealed.fingerprint),q(owner),"1::smallint",q(sealed.envelope),q(product.productId),q(product.basePlanId)].join(",");
const args=(owner,g,expires)=>[q(fp),q(owner),integer(g),q(expires)].join(",");
let allowed=true;
const runtime=createDisposablePlayRuntime({scope:"disposable_pg17",enabled:()=>true,authorize:async request=>allowed&&request.headers.get("authorization")==="Bearer synthetic-session"?{owner,sessionId:session,role:"player"}:null,
 catalog:async()=>[{...localized,environment:"test",expiresAt:Date.now()+30000}],db:adapter,vault,provider:client,
 simulateAcknowledgment:async(receipt,t)=>(await acknowledgeTestPurchase(receipt,t,{verify:(o,x)=>client.verify(o,x),fingerprint:x=>vault.fingerprint(x,"test"),confirmDurableFulfillment:r=>adapter.confirm(r,r.generation,r.expiresAt),accessToken:async()=>"fixture-oauth",request:fakeRequest,now:Date.now}))==="reverify_required",now:Date.now});
const authenticated=new Request("https://fixture.invalid/sync",{headers:{authorization:"Bearer synthetic-session"}});
const synchronize=async()=> (await runtime.sync(authenticated,product.productId,token))?.outcome??"held";
assert.equal(await runtime.sync(new Request("https://fixture.invalid/sync"),product.productId,token),null);
assert.equal((await runtime.sync(authenticated,product.productId,token))?.outcome,"pending_fulfillment");
let marker=null,launches=0,storeState="empty",launchOutcome="cancelled";
const storage={read:async()=>marker,write:async v=>{marker=v;},remove:async()=>{marker=null;}};
const request=async(action,t,body)=>{
 if(action==="identity")return runtime.identity(req({},t));
 if(action==="sync"){const result=await runtime.sync(req({},t),body.productId,body.purchaseToken,body.intentId);console.log("Synthetic sync outcome:",result?.outcome??"held");return result;}
 const response=await runtime.intent(req(body,t),action);
 return response.ok?response.json():null;
};
const makeCoordinator=()=>{
 const bridge=createPlaySandboxBridge({scope:"synthetic",enabled:()=>true,available:()=>true,session:async()=>allowed?{owner,token:"synthetic-session",role:"player"}:null,request,
 journal:createPlayRecoveryJournal(storage),now:Date.now,native:{
 launch:async()=>{launches++;if(launchOutcome==="launched")storeState="pending";return launchOutcome;},
 restore:async id=>({accountId:id,pendingCount:storeState==="pending"?1:0,candidates:storeState==="purchased"?[{productId:product.productId,accountId:id,token}]:[]})
 }});
 bridge.setOwner(owner);return bridge;
};
let mobile=makeCoordinator();
assert.equal(await mobile.prepare(localized),true);
assert.equal(await mobile.launch(),"cancelled");assert.equal(marker,null);
launchOutcome="launched";
assert.equal(await mobile.prepare(localized),true);assert.equal(await mobile.launch(),"launched");
assert.equal(launches,2);assert.ok(marker);
mobile=makeCoordinator();assert.equal(await mobile.prepare(localized),false);
assert.deepEqual(await mobile.foreground(),{verified:0,pending:1,failed:0});
assert.equal(ackCount,0);
storeState="purchased";
assert.deepEqual(await mobile.purchaseUpdated({forged:true}),{verified:1,pending:0,failed:0});
assert.equal(marker,null);
assert.equal(ackCount,1);
assert.equal(sql("select provider||':'||plan from play_billing_candidate.shadow_membership_entitlements where user_id="+q(owner)),"google_play_test:premium");
assert.equal(sql("select count(*) from public.membership_sources where user_id="+q(owner)),"0");
assert.deepEqual(await mobile.recover(account),{verified:1,pending:0,failed:0});
assert.equal(ackCount,1);
assert.equal(sql("select play_billing_candidate.claim_test_purchase("+claimArgs(foreign,vault.seal(token,foreign,"test"))+")"),"foreign_owner");
allowed=false;assert.equal(await synchronize(),"held");assert.equal(ackCount,1);
// Signed synthetic push -> actual durable queue -> actual generation-fenced
// observation -> revoked shadow access; Google provider is still mocked.
const sub="projects/fixture-project/subscriptions/fixture-play";
const config={audience:"https://fixture.invalid/play/push",email:env.HOOPCHECK_PLAY_SERVICE_ACCOUNT_EMAIL,subject:"123456789"};
const now=Date.now(),sec=Math.floor(now/1000),b64=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
const unsigned=b64({alg:"RS256",kid:"fixture"})+"."+b64({iss:"https://accounts.google.com",aud:config.audience,email:config.email,email_verified:true,sub:config.subject,iat:sec-1,exp:sec+3590});
const auth="Bearer "+unsigned+"."+crypto.sign("RSA-SHA256",Buffer.from(unsigned),privateKey).toString("base64url");
const keyRequest=async(url,init)=>{assert.equal(url,"https://www.googleapis.com/oauth2/v3/certs");assert.equal(init.method,"GET");return json({keys:[{...publicKey.export({format:"jwk"}),kid:"fixture",alg:"RS256",use:"sig"}]});};
const event={subscription:sub,message:{messageId:"987654321",data:Buffer.from(JSON.stringify({version:"1.0",packageName:"online.hoopcheck.app",eventTimeMillis:String(now),subscriptionNotification:{version:"1.0",notificationType:13,purchaseToken:token}})).toString("base64")}};
const ingress={enabled:()=>true,authenticate:a=>authenticatePlayPush(a,config,keyRequest,now),subscription:sub,fingerprint:t=>vault.fingerprint(t,"test"),enqueue:adapter.enqueue,now:()=>now};
assert.equal(await ingestPlayPush(event,auth,ingress),"accepted");assert.equal(await ingestPlayPush(event,auth,ingress),"accepted");
assert.equal(sql("select count(*) from play_billing_candidate.notification_jobs where message_id='987654321'"),"1");
const ports={enabled:()=>true,lease:adapter.lease,lookup:adapter.lookup,open:async c=>vault.open(await adapter.credential(c),c.owner,"test"),fingerprint:t=>vault.fingerprint(t,"test"),begin:adapter.begin,verify:runtime.notificationVerify,complete:adapter.complete,finish:adapter.finish,now:Date.now};
// A renewal/refresh must preserve a fulfilled shadow membership at the new generation.
assert.equal(await reconcileOnePlayNotification(ports),"done");
assert.equal(sql("select provider||':'||plan from play_billing_candidate.shadow_membership_entitlements where user_id="+q(owner)),"google_play_test:premium");
const expiredEvent={...event,message:{...event.message,messageId:"987654322"}};
assert.equal(await ingestPlayPush(expiredEvent,auth,ingress),"accepted");
revoked=true;
assert.equal(await reconcileOnePlayNotification(ports),"done");
assert.equal(sql("select play_billing_candidate.read_test_observation("+q(fp)+","+q(owner)+")"),"inactive");
assert.equal(sql("select count(*) from play_billing_candidate.shadow_membership_entitlements where user_id="+q(owner)),"0");
assert.equal(sql("select count(*) from public.membership_sources where user_id="+q(owner)),"0");
assert.equal(sql("select status from play_billing_candidate.notification_jobs where message_id='987654322'"),"done");
console.log("End-to-end synthetic Google Play integration passed: intent, encrypted ownership, provider verification, durable fulfillment, simulated acknowledgment, shadow membership, authenticated notification, dedupe and revocation.");

// Restore active test evidence before holding the owner, to prove immediate removal.
revoked=false;
allowed=true;
assert.equal(await synchronize(),"test_fulfillment_confirmed");
assert.equal(sql("select provider||':'||plan from play_billing_candidate.shadow_membership_entitlements where user_id="+q(owner)),"google_play_test:premium");
const activeGeneration=Number(sql("select generation from play_billing_candidate.purchase_observations where fingerprint="+q(fp)));
assert.equal(sql("select play_billing_candidate.confirm_test_fulfillment("+args(owner,activeGeneration,expiry)+")"),"t");
// Privacy hold: stop credential lookup and all future fulfillment; do not
// claim a legal retention policy or destroy immutable ownership evidence.
assert.equal(await adapter.holdOwner(owner),true);
assert.equal(await mobile.foreground(),null);
assert.equal(await mobile.prepare(localized),false);
assert.equal(sql("select play_billing_candidate.confirm_test_fulfillment("+args(owner,activeGeneration,expiry)+")"),"f");
assert.equal(await adapter.lookup(fp),null);
await assert.rejects(()=>adapter.credential({owner,fingerprint:fp,productId:product.productId,basePlanId:product.basePlanId}));
await assert.rejects(()=>adapter.begin({owner,fingerprint:fp,productId:product.productId,basePlanId:product.basePlanId}));
assert.equal(sql("select count(*) from play_billing_candidate.shadow_membership_entitlements where user_id="+q(owner)),"0");
assert.equal(sql("select count(*) from play_billing_candidate.purchase_claims where fingerprint="+q(fp)),"1");
assert.equal(sql("select has_table_privilege('authenticated','play_billing_candidate.owner_holds','SELECT')"),"f");
assert.equal(sql("select has_table_privilege('service_role','play_billing_candidate.owner_holds','DELETE')"),"f");
console.log("Test owner deletion freeze passed: credential lookup blocked, no future writes, shadow access absent, no client privileges.");
