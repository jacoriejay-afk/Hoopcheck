import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as crypto from "node:crypto";
import ts from "typescript";
const exports={};
new Function("exports","require",ts.transpileModule(readFileSync(new URL("../lib/server/play/push-auth.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,k=>{if(k==="server-only")return {};if(k==="node:crypto")return crypto;throw Error("Unexpected import");});
const {authenticatePlayPush}=exports;
const {privateKey,publicKey}=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
const config={audience:"https://fixture.invalid/play/push",email:"fixture@fixture.iam.gserviceaccount.com",subject:"123456789"};
const now=Date.parse("2026-11-28T00:00:00Z"),sec=now/1000;
const claims={iss:"https://accounts.google.com",aud:config.audience,email:config.email,email_verified:true,sub:config.subject,iat:sec-10,exp:sec+3590};
const key={...publicKey.export({format:"jwk"}),kid:"fixture",alg:"RS256",use:"sig"};
const b64=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
function jwt(c=claims,h={alg:"RS256",kid:"fixture"}){const raw=b64(h)+"."+b64(c);return "Bearer "+raw+"."+crypto.sign("RSA-SHA256",Buffer.from(raw),privateKey).toString("base64url");}
const request=async(url,init)=>{assert.equal(url,"https://www.googleapis.com/oauth2/v3/certs");assert.equal(init.redirect,"error");return new Response(JSON.stringify({keys:[key]}));};
test("valid signed Google identity is bound to configured audience, email and subject",async()=>{await authenticatePlayPush(jwt(),config,request,now);});
test("wrong identity, expiry, algorithm and embedded keys fail closed",async()=>{
 for(const patch of [{aud:"other"},{email:"other@fixture.iam.gserviceaccount.com"},{email_verified:false},{sub:"999"},{iss:"https://other.invalid"},{exp:sec},{iat:sec+120},{nbf:sec+100}])await assert.rejects(authenticatePlayPush(jwt({...claims,...patch}),config,request,now),{message:"Google Play push authentication failed."});
 for(const h of [{alg:"none",kid:"fixture"},{alg:"RS256",kid:"fixture",jku:"https://other.invalid"}])await assert.rejects(authenticatePlayPush(jwt(claims,h),config,request,now));
});
test("wrong key, duplicate kid, bad signature, oversized keys and provider failure rejected",async()=>{
 const other=crypto.generateKeyPairSync("rsa",{modulusLength:2048}).publicKey.export({format:"jwk"});
 for(const response of [()=>new Response(JSON.stringify({keys:[{...key,...other}]})),()=>new Response(JSON.stringify({keys:[key,key]})),()=>new Response("x".repeat(65537)),()=>new Response("private diagnostic",{status:503})])await assert.rejects(authenticatePlayPush(jwt(),config,async()=>response(),now),{message:"Google Play push authentication failed."});
 const t=jwt().split(".");t[2]=(t[2][0]==="A"?"B":"A")+t[2].slice(1);await assert.rejects(authenticatePlayPush(t.join("."),config,request,now));
});
