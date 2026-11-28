import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const source=ts.transpileModule(read("../lib/owner/launch-review.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function("exports",source)(exports);
const {evaluateLaunchPacket,launchGates}=exports;
const candidate="a".repeat(40),now=Date.parse("2026-11-28T10:00:00.000Z"),checkedAt="2026-11-28T09:00:00.000Z",evidence="https://github.com/jacoriejay-afk/Hoopcheck/pull/1184";
const fixture=(stage="internal")=>({sha:candidate,iosBuild:"17",androidBuild:"17",stage,openP0:0,openP1:0,observedAt:checkedAt,previousStage:stage==="internal"?null:{stage:stage==="closed_beta"?"internal":stage==="controlled_release"?"closed_beta":"controlled_release",windowStart:"2026-11-20T00:00:00.000Z",windowEnd:"2026-11-28T00:00:00.000Z",evidence,reviewer:"fixture"},gates:launchGates.map(gate=>({gate,sha:candidate,iosBuild:"17",androidBuild:"17",stage,result:"pass",evidence,reviewer:"fixture",checkedAt}))});
const check=(v=fixture(),expected=candidate,time=now)=>evaluateLaunchPacket(JSON.stringify(v),expected,time);
test("all stages require complete review evidence but never grant rollout authorization",()=>{
 for(const stage of ["internal","closed_beta","controlled_release","expansion"])assert.equal(check(fixture(stage)).state,"PACKET_COMPLETE_REVIEW_REQUIRED");
});
test("missing, duplicate, invalid and candidate-mismatched packets fail closed",()=>{
 for(const mutate of [v=>v.gates.pop(),v=>v.gates[1]=v.gates[0],v=>v.sha="b".repeat(40),v=>v.gates[0].androidBuild="16",v=>v.gates[0].checkedAt="2026-11-01T00:00:00.000Z",v=>v.gates[0].checkedAt="2026-11-29T00:00:00.000Z",v=>v.gates[0].evidence="https://example.invalid",v=>v.gates[0].result="fail",v=>v.user_id="fixture",v=>v.gates[0].stage="expansion"]){const v=fixture();mutate(v);assert.equal(check(v).state,"HOLD");}
 assert.equal(evaluateLaunchPacket(undefined,candidate,now).state,"HOLD");
 assert.equal(evaluateLaunchPacket(JSON.stringify(fixture()),undefined,now).state,"HOLD");
});
test("incident and previous-stage boundaries block advancement",()=>{
 for(const field of ["openP0","openP1"]){const v=fixture();v[field]=1;assert.equal(check(v).state,"HOLD");}
 const v=fixture("controlled_release");v.previousStage.windowStart="2026-11-27T00:00:00.000Z";assert.equal(check(v).state,"HOLD");
 v.previousStage=null;assert.equal(check(v).state,"HOLD");
});
test("owner authorization precedes packet read and no release action exists",()=>{
 const page=read("../app/owner-hq/launch-readiness/page.tsx");
 assert.ok(page.indexOf('await requireAmbassadorSession("/owner-hq/launch-readiness",true)')<page.indexOf("process.env.HOOPCHECK_LAUNCH_REVIEW_JSON"));
 assert.match(page,/VERCEL_GIT_COMMIT_SHA/);
 assert.match(page,/HOOPCHECK_LAUNCH_REVIEW_ENABLED==="true"/);
 assert.doesNotMatch(page,/supabase|\.insert\(|\.update\(|fetch\(/);
});
