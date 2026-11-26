import assert from "node:assert/strict";
import test from "node:test";
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { verifyAppleIdentity, exchangeAppleAuthorization, encryptAppleToken, decryptAppleToken, revokeAppleAuthorization } from "../lib/server/apple-sign-in-authorization.ts";

const rsa=generateKeyPairSync("rsa",{modulusLength:2048});
const ec=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
const keys=[{...rsa.publicKey.export({format:"jwk"}),kid:"fixture",alg:"RS256",use:"sig"}];
const config={teamId:"TEAM000001",keyId:"KEY0000001",privateKey:ec.privateKey.export({format:"pem",type:"pkcs8"}).toString()};
const nonce=randomBytes(32).toString("hex");
const hashedNonce=createHash("sha256").update(nonce).digest("hex");
const jwt=overrides=>{
 const now=Math.floor(Date.now()/1000), enc=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
 const base=enc({alg:"RS256",kid:"fixture"})+"."+enc({iss:"https://appleid.apple.com",aud:"online.hoopcheck.app",sub:"apple-subject-a",nonce:hashedNonce,iat:now,exp:now+300,...overrides});
 return base+"."+sign("RSA-SHA256",Buffer.from(base),rsa.privateKey).toString("base64url");
};
test("Apple identity requires a valid signature, issuer, audience, subject and nonce",()=>{
 assert.equal(verifyAppleIdentity(jwt({}),keys,"apple-subject-a",hashedNonce).sub,"apple-subject-a");
 for(const changes of [{sub:"apple-subject-b"},{aud:"other.app"},{iss:"https://other.invalid"},{nonce:"wrong"},{exp:0},{iat:0}])
  assert.throws(()=>verifyAppleIdentity(jwt(changes),keys,"apple-subject-a",hashedNonce));
 const [h,p]=jwt({}).split(".");
 assert.throws(()=>verifyAppleIdentity(h+"."+p+".invalid",keys,"apple-subject-a",hashedNonce));
});
test("authorization code exchange refuses mismatched identity before returning refresh token",async()=>{
 const input={code:"fixture-code",identityToken:jwt({}),rawNonce:nonce,subject:"apple-subject-a"};
 let calls=0;
 const request=async(url,init)=>{
  calls++;assert.equal(url,"https://appleid.apple.com/auth/token");assert.equal(init.redirect,"error");
  assert.equal(init.body.get("code"),"fixture-code");assert.equal(init.body.get("client_id"),"online.hoopcheck.app");
  assert.equal(init.body.get("grant_type"),"authorization_code");assert.equal(init.body.get("client_secret").split(".").length,3);
  return Response.json({id_token:jwt({}),refresh_token:"fixture-refresh"});
 };
 assert.equal(await exchangeAppleAuthorization(input,keys,config,request),"fixture-refresh");
 await assert.rejects(exchangeAppleAuthorization({...input,subject:"apple-subject-b"},keys,config,request));assert.equal(calls,1);
 await assert.rejects(exchangeAppleAuthorization(input,keys,config,async()=>Response.json({id_token:jwt({sub:"apple-subject-b"}),refresh_token:"wrong"})));
});
test("encrypted token is owner and provider-bound; revocation requires acknowledgment",async()=>{
 const key=randomBytes(32).toString("base64"),owner="user-a",subject="apple-subject-a";
 const envelope=encryptAppleToken("fixture-refresh",owner,subject,key);
 assert.notEqual(envelope,encryptAppleToken("fixture-refresh",owner,subject,key));
 assert.ok(!envelope.includes("fixture-refresh"));
 assert.equal(decryptAppleToken(envelope,owner,subject,key),"fixture-refresh");
 assert.throws(()=>decryptAppleToken(envelope,"user-b",subject,key));
 assert.throws(()=>decryptAppleToken(envelope,owner,"apple-subject-b",key));
 let calls=0;await revokeAppleAuthorization(envelope,owner,subject,key,config,async(url,init)=>{
  calls++;assert.equal(url,"https://appleid.apple.com/auth/revoke");assert.equal(init.body.get("token"),"fixture-refresh");assert.equal(init.body.get("token_type_hint"),"refresh_token");
  return new Response(null,{status:200});
 });assert.equal(calls,1);
 await assert.rejects(revokeAppleAuthorization(envelope,owner,subject,key,config,async()=>new Response(null,{status:503})),/not confirmed/);
});
