import test from "node:test";
import assert from "node:assert/strict";
import { dataConfidence } from "../src/native/dataConfidence.ts";
const now=Date.parse("2026-11-26T12:30:00Z"), observedAt="2026-11-26T12:00:00Z", expiresAt="2026-11-26T13:00:00Z";
test("current evidence stays explicitly a reviewed snapshot and expiry fails closed",()=>{
 const e={kind:"reviewed-provider",observedAt,expiresAt};
 assert.equal(dataConfidence(e,now).state,"reviewed-provider");
 assert.equal(dataConfidence(e,Date.parse(expiresAt)).state,"expired");
 assert.equal(dataConfidence({...e,observedAt:"invalid"},now).state,"unavailable");
 assert.equal(dataConfidence({...e,observedAt:expiresAt},now).state,"unavailable");
 assert.equal(dataConfidence(e,NaN).state,"unavailable");
});
test("directory, self-reported, provisional and missing evidence are distinct",()=>{
 for(const kind of ["directory-record","self-reported","provisional","unavailable"])assert.equal(dataConfidence({kind},now).state,kind);
 assert.match(dataConfidence({kind:"self-reported"},now).detail,/not been independently verified/);
});
