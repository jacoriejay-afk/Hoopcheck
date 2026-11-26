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

const directoryExperimentSource=readFileSync(new URL("../lib/directory-layout-experiment.ts",import.meta.url),"utf8");
const directoryExperimentJs=ts.transpileModule(directoryExperimentSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {assignDirectoryVariant,effectiveDirectoryVariant}=await import("data:text/javascript;base64,"+Buffer.from(directoryExperimentJs).toString("base64"));
test("directory layout assignment is deterministic, consent-based and fails closed",()=>{
 assert.equal(assignDirectoryVariant(0),"control");
 assert.equal(assignDirectoryVariant(0x7fffffff),"control");
 assert.equal(assignDirectoryVariant(0x80000000),"compact");
 assert.equal(assignDirectoryVariant(0xffffffff),"compact");
 for(const seed of [NaN,-1,1.5,0x100000000])assert.equal(assignDirectoryVariant(seed),"control");
 assert.equal(effectiveDirectoryVariant(false,"compact"),"control");
 assert.equal(effectiveDirectoryVariant(true,"unknown"),"control");
 assert.equal(effectiveDirectoryVariant(true,"compact"),"compact");
});
test("directory experiment does not change filtered categories or send experiment events",()=>{
 const page=readFileSync(new URL("../app/directory/page.tsx",import.meta.url),"utf8");
 assert.match(page,/window\.localStorage\.removeItem\(directoryExperimentKey\)/);
 assert.match(page,/NEXT_PUBLIC_HOOPCHECK_DIRECTORY_EXPERIMENT_ENABLED==="true"/);
 assert.match(page,/visible\.map\(\(category\)/);
 assert.doesNotMatch(page,/analytics_events|trackEvent|fetch\(/);
});
