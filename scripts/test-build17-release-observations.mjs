import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../lib/owner/release-observations.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseReleaseObservation,compareReleaseObservations}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const fixture=()=>({baseline:{sha:"a".repeat(40),build:"16",platform:"ios",source:"fixture",coverage:"cohort-v1",windowStart:"2026-11-23T00:00:00.000Z",windowEnd:"2026-11-24T00:00:00.000Z",metrics:{startup_failure:{numerator:1,denominator:100},signup_completion:{numerator:80,denominator:100}}},candidate:{sha:"b".repeat(40),build:"17",platform:"ios",source:"fixture",coverage:"cohort-v1",windowStart:"2026-11-24T00:00:00.000Z",windowEnd:"2026-11-25T00:00:00.000Z",metrics:{startup_failure:{numerator:3,denominator:100},signup_completion:{numerator:78,denominator:100}}}});
const now=Date.parse("2026-11-26T00:00:00.000Z");
test("compares matched aggregates and flags deterioration in correct direction",()=>{
 const obs=parseReleaseObservation(JSON.stringify(fixture()));assert.ok(obs);
 const result=compareReleaseObservations(obs,now);
 assert.equal(result.find(x=>x.metric==="startup_failure").state,"review");
 assert.equal(result.find(x=>x.metric==="signup_completion").state,"review");
 assert.equal(result.find(x=>x.metric==="request_failure").state,"unavailable");
 assert.ok(compareReleaseObservations(obs,now+8*86400000).every(x=>x.state==="unavailable"));
});
test("rejects mismatched windows, source, invalid numbers, individual data and duplicate versions",()=>{
 for(const mutate of [x=>x.candidate.platform="web",x=>x.candidate.coverage="other",x=>x.candidate.source="other",x=>x.candidate.windowEnd="2026-11-26T00:00:00.000Z",x=>x.candidate.sha=x.baseline.sha,x=>x.candidate.metrics.startup_failure.numerator=101,x=>x.candidate.metrics.signup_completion.user_id="private",x=>x.candidate.email="person@example.invalid"]){
  const x=fixture();mutate(x);assert.equal(parseReleaseObservation(JSON.stringify(x)),null);
 }
 const x=fixture();x.candidate.metrics.startup_failure={numerator:0,denominator:99};assert.equal(compareReleaseObservations(parseReleaseObservation(JSON.stringify(x)),now)[0].state,"unavailable");
});
test("owner authorization precedes observation parsing and no client data is collected",()=>{
 const page=readFileSync(new URL("../app/owner-hq/page.tsx",import.meta.url),"utf8");
 assert.ok(page.indexOf('await requireAmbassadorSession("/owner-hq", true)')<page.indexOf("parseReleaseObservation(process.env."));
 assert.match(page,/No valid release observations supplied/);
});

const activationSource=readFileSync(new URL("../lib/owner/activation-diagnostics.ts",import.meta.url),"utf8");
const activationJs=ts.transpileModule(activationSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {activationWindow,aggregateWebActivation}=await import("data:text/javascript;base64,"+Buffer.from(activationJs).toString("base64"));
test("activation uses a mature cohort, distinct profiles and first-week research page views",()=>{
 const w=activationWindow(Date.parse("2026-11-26T16:00:00Z"));assert.equal(w.start,"2026-11-12T00:00:00.000Z");assert.equal(w.end,"2026-11-19T00:00:00.000Z");
 const profiles=Array.from({length:25},(_,i)=>({id:String(i),created_at:"2026-11-13T12:00:00Z"}));
 const events=profiles.slice(0,12).map(p=>({user_id:p.id,path:"/pre-sign",created_at:"2026-11-14T12:00:00Z"}));
 events.push(events[0],{user_id:"12",path:"/pre-sign",created_at:"2026-11-20T12:00:00Z"},{user_id:"13",path:"/login",created_at:"2026-11-14T12:00:00Z"},{user_id:"14",path:"/pre-sign",created_at:"2026-11-12T12:00:00Z"});
 assert.deepEqual(aggregateWebActivation(profiles,events),{profiles:25,observed:12});
 assert.deepEqual(aggregateWebActivation(profiles,[]),{profiles:25,observed:null});
 assert.equal(aggregateWebActivation(profiles.slice(0,9),events),null);
 assert.equal(aggregateWebActivation([...profiles,profiles[0]],events),null);
});
test("activation reporting is owner-only, disabled by default and bounded",()=>{
 const page=readFileSync(new URL("../app/owner-hq/activation/page.tsx",import.meta.url),"utf8"),reader=readFileSync(new URL("../lib/owner/read-activation-diagnostics.ts",import.meta.url),"utf8");
 assert.ok(page.indexOf('await requireAmbassadorSession("/owner-hq/activation",true)')<page.indexOf("await readActivationDiagnostics()"));
 assert.ok(reader.indexOf('process.env.HOOPCHECK_ACTIVATION_DIAGNOSTICS_ENABLED!=="true"')<reader.indexOf("const db=ambassadorDb()"));
 assert.match(reader,/limit\(perBatchLimit\+1\)/);assert.match(page,/not a verified activation event/);
});
