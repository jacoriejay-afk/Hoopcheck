import assert from "node:assert/strict";
import {test} from "node:test";
import {requestNativeAccount, NativeAccountEndpointUnavailable} from "../src/native/accountClient.ts";
import {requestCareer} from "../src/native/careerClaims.ts";
import {readServiceObservation} from "../src/native/serviceObservation.ts";
const origin="https://fixture.hoopcheck.test";
const missing=()=>Promise.resolve(new Response("<html>404 PRIVATE-FIXTURE</html>",{status:404,headers:{"Content-Type":"text/html"}}));
test("missing account endpoint fails closed without surfacing HTML",async()=>{
 await assert.rejects(requestNativeAccount(origin,"fixture",undefined,missing),error=>error instanceof NativeAccountEndpointUnavailable&&!error.message.includes("PRIVATE-FIXTURE"));
 await assert.rejects(requestNativeAccount(origin,"fixture",undefined,async()=>new Response(null,{status:401})),error=>!(error instanceof NativeAccountEndpointUnavailable));
});
test("missing career endpoints never return fabricated claims or write success",async()=>{
 for(const path of ["claims","historical-clubs"]){
  await assert.rejects(requestCareer(origin,"fixture",path,{},missing),/not available on this server/);
 }
 await assert.rejects(requestCareer(origin,"fixture","claims",{body:{kind:"claim"}},missing),/not available on this server/);
});
test("404 service status is not a healthy observation",async()=>{
 await assert.rejects(readServiceObservation(origin,missing),/not available on this server/);
});
