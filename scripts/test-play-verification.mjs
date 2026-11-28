import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {generateKeyPairSync,verify} from "node:crypto";
import ts from "typescript";
const load=(path,requires={})=>{const exports={};new Function("exports","require",ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,key=>{if(Object.hasOwn(requires,key))return requires[key];throw Error("Unexpected import");});return exports;};
const crypto=await import("node:crypto");
const products=load("../lib/billing/play-products.ts");
const classifier=load("../lib/billing/play-subscription.ts",{"./play-products":products});
const {createPlayVerificationClient,playAccountId}=load("../lib/server/play/verification.ts",{"server-only":{},"node:crypto":crypto,"../../billing/play-products":products,"../../billing/play-subscription":classifier});
const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const owner="11111111-1111-4111-8111-111111111111",token="synthetic-token-not-a-real-purchase",now=Date.parse("2026-11-28T00:00:00Z");
const env={HOOPCHECK_PLAY_VERIFICATION_ENABLED:"true",HOOPCHECK_PLAY_ENVIRONMENT:"test",NEXT_PUBLIC_SUPABASE_URL:"https://fixture.supabase.co",HOOPCHECK_PLAY_ISOLATED_SUPABASE_URL:"https://fixture.supabase.co",HOOPCHECK_PLAY_SERVICE_ACCOUNT_EMAIL:"fixture@fixture.iam.gserviceaccount.com",HOOPCHECK_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY:privateKey.export({format:"pem",type:"pkcs8"}).toString(),HOOPCHECK_PLAY_ACCOUNT_HMAC_KEY:"ab".repeat(32)};
const json=v=>new Response(JSON.stringify(v),{headers:{"content-type":"application/json"}});
const payload=()=>({externalAccountIdentifiers:{obfuscatedExternalAccountId:playAccountId(owner,env.HOOPCHECK_PLAY_ACCOUNT_HMAC_KEY)},testPurchase:{},subscriptionState:"SUBSCRIPTION_STATE_ACTIVE",acknowledgementState:"ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",lineItems:[{productId:"hoopcheck.pro",offerDetails:{basePlanId:"monthly"},autoRenewingPlan:{autoRenewEnabled:true},expiryTime:"2026-12-28T00:00:00Z"}]});
test("account binding is deterministic, domain-separated and rejects malformed owner/key",()=>{
 const id=playAccountId(owner,env.HOOPCHECK_PLAY_ACCOUNT_HMAC_KEY);assert.match(id,/^[a-f0-9]{64}$/);assert.notEqual(id,playAccountId(owner,"cd".repeat(32)));assert.notEqual(id,playAccountId("22222222-2222-4222-8222-222222222222",env.HOOPCHECK_PLAY_ACCOUNT_HMAC_KEY));
 assert.throws(()=>playAccountId("bad",env.HOOPCHECK_PLAY_ACCOUNT_HMAC_KEY));assert.throws(()=>playAccountId(owner,"bad"));
});
test("default-off and wrong environments fail before any requests",()=>{
 for(const patch of [{HOOPCHECK_PLAY_VERIFICATION_ENABLED:"false"},{HOOPCHECK_PLAY_ENVIRONMENT:"production"},{VERCEL_ENV:"production"},{NEXT_PUBLIC_SUPABASE_URL:"https://other.supabase.co"},{NEXT_PUBLIC_SUPABASE_URL:"https://ucbdceaieyenljcwlhnj.supabase.co",HOOPCHECK_PLAY_ISOLATED_SUPABASE_URL:"https://ucbdceaieyenljcwlhnj.supabase.co"},{HOOPCHECK_PLAY_ACCOUNT_HMAC_KEY:"bad"}])assert.throws(()=>createPlayVerificationClient({...env,...patch},()=>{throw Error("unexpected request")},()=>now));
});
test("OAuth assertion is signed, scoped and short-lived; exact pinned package GET is read-only",async()=>{
 const calls=[];const request=async(url,init)=>{calls.push(url);assert.equal(init.redirect,"error");assert.equal(init.cache,"no-store");if(calls.length===1){assert.equal(url,"https://oauth2.googleapis.com/token");assert.equal(init.method,"POST");const form=new URLSearchParams(init.body);const [h,p,s]=form.get("assertion").split(".");const claim=JSON.parse(Buffer.from(p,"base64url"));assert.equal(claim.aud,url);assert.equal(claim.iss,env.HOOPCHECK_PLAY_SERVICE_ACCOUNT_EMAIL);assert.equal(claim.exp-claim.iat,300);assert.equal(claim.scope,"https://www.googleapis.com/auth/androidpublisher");assert.equal(verify("RSA-SHA256",Buffer.from(h+"."+p),publicKey,Buffer.from(s,"base64url")),true);return json({access_token:"synthetic-access-token",token_type:"Bearer",expires_in:3600});}assert.equal(url,"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/online.hoopcheck.app/purchases/subscriptionsv2/tokens/"+token);assert.equal(init.method,"GET");assert.equal(init.headers.Authorization,"Bearer synthetic-access-token");return json(payload());};
 const client=createPlayVerificationClient(env,request,()=>now);const result=await client.verify(owner,token);assert.equal(result.state,"eligible_for_reconciliation");assert.equal(calls.length,2);assert.doesNotMatch(JSON.stringify(result),/synthetic-token|synthetic-access|externalAccountIdentifiers/);
});
test("unsafe token paths, HTTP errors, oversize responses and malformed OAuth fail without leaking input",async()=>{
 for(const bad of ["../fixture","a/b/c","https://evil.invalid","x".repeat(4097)]){const client=createPlayVerificationClient(env,()=>{throw Error("unexpected request")},()=>now);await assert.rejects(client.verify(owner,bad),{message:"Google Play verification is unavailable."});}
 for(const response of [()=>new Response("private diagnostic "+token,{status:403}),()=>new Response("x".repeat(270000)),()=>json({access_token:"bad\nvalue",token_type:"Bearer",expires_in:3600})]){const client=createPlayVerificationClient(env,async()=>response(),()=>now);await assert.rejects(client.verify(owner,token),{message:"Google Play verification is unavailable."});}
});
test("provider account mismatch and non-test purchases fail closed",async()=>{
 for(const mutate of [v=>delete v.testPurchase,v=>v.externalAccountIdentifiers.obfuscatedExternalAccountId="c".repeat(64)]){const v=payload();mutate(v);let n=0;const client=createPlayVerificationClient(env,async()=>++n===1?json({access_token:"synthetic",token_type:"Bearer",expires_in:3600}):json(v),()=>now);assert.equal((await client.verify(owner,token)).state,"invalid");}
});
