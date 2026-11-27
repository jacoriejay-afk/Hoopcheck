import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { privacyRequestLabels, privacyRequestPayload, privacyRequestRows } from "../src/native/privacyRequests.ts";
import { nativeDestination } from "../src/native/deepLinks.ts";
import { rememberDestination, takeDestination } from "../src/native/pendingDestination.ts";
const owner="11111111-1111-4111-8111-111111111111";
test("privacy payload matches the existing request types and never accepts admin fields",()=>{
  for(const type of Object.keys(privacyRequestLabels))assert.deepEqual(privacyRequestPayload(owner,type,"  Please export my data  "),{requester_id:owner,request_type:type,details:"Please export my data"});
  for(const [id,type,details] of [["", "export","valid details"],[owner,"__proto__","valid details"],[owner,"admin","valid details"],[owner,"export","  short  "],[owner,"export","x".repeat(5001)]])assert.throws(()=>privacyRequestPayload(id,type,details));
});
test("privacy history rejects malformed records and strips internal notes",()=>{
  const row={id:"r1",request_type:"export",status:"pending",details:"My data export",created_at:"2026-11-26T12:00:00Z"};
  assert.deepEqual(privacyRequestRows([{...row,admin_notes:"secret",requester_id:owner}]),[row]);
  for(const invalid of [null,{},[{...row,created_at:"bad"}],[{...row,request_type:"unknown"}]])assert.throws(()=>privacyRequestRows(invalid));
});
test("privacy center routes natively without retaining sensitive URL fields",()=>{
  for(const path of ["/privacy-center","/account/privacy-center"])assert.equal(nativeDestination(path+"?token=private"),"/account/privacy-center");
  rememberDestination("/account/privacy-center?token=private");assert.equal(takeDestination(),"/account/privacy-center");
  const source=readFileSync(new URL("../app/account/privacy-center.tsx",import.meta.url),"utf8");
  assert.match(source,/\.eq\("requester_id",owner\)/);
  assert.match(source,/data\.session\?\.user\.id !== owner/);
  assert.match(source,/getUser\(token\)/);
  assert.match(source,/verified\.data\.user\?\.id !== owner/);
  assert.match(source,/\.range\(0,limit\)\.setHeader\("Authorization", "Bearer "\+token\)/);
  assert.match(source,/\.insert\(payload\)\.setHeader\("Authorization", "Bearer "\+token\)/);
  assert.match(source,/activeRead\.current\?\.abort\(\)/);
  assert.match(source,/inFlight\.current\|\|offline\|\|uncertain/);
  assert.doesNotMatch(source,/AsyncStorage|admin_notes|service_role/);
});
