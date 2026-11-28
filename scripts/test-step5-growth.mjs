import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const source=ts.transpileModule(read("../lib/owner/growth-snapshot.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function("exports",source)(exports);
const {parseGrowthSnapshot,growthSummary}=exports;
const now=Date.parse("2026-11-28T10:00:00.000Z");
const fixture={windowStart:"2026-11-21T00:00:00.000Z",windowEnd:"2026-11-28T00:00:00.000Z",source:"Reviewed synthetic fixture",coverage:"web_ios_android",weeklyActiveUsers:250,rates:{signup_conversion:{numerator:50,denominator:100}}};
const parse=(v=fixture,time=now)=>parseGrowthSnapshot(JSON.stringify(v),time);
test("aggregate goal and cohort metrics calculate correctly",()=>{
 const s=growthSummary(parse());assert.equal(s.weeklyActiveUsers,250);assert.equal(s.remaining,750);assert.equal(s.progress,25);assert.equal(s.rates[0].percent,50);assert.equal(s.rates[1].percent,null);
 const over=growthSummary(parse({...fixture,weeklyActiveUsers:1200}));assert.equal(over.remaining,0);assert.equal(over.progress,100);
});
test("missing, stale, partial, malformed and future evidence is unavailable",()=>{
 assert.equal(parseGrowthSnapshot(undefined,now),null);
 for(const v of [{...fixture,coverage:"web"},{...fixture,weeklyActiveUsers:-1},{...fixture,weeklyActiveUsers:1.2},{...fixture,user_id:"fixture"},{...fixture,rates:{signup_conversion:{numerator:101,denominator:100}}},{...fixture,windowStart:"2026-11-22T00:00:00.000Z"}])assert.equal(parse(v),null);
 assert.equal(parse(fixture,now+8*86400000),null);
 assert.equal(parse(fixture,now-86400000),null);
 assert.equal(growthSummary(null).weeklyActiveUsers,null);
});
test("small cells including complementary cells remain suppressed",()=>{
 const s=growthSummary(parse({...fixture,weeklyActiveUsers:9,rates:{signup_conversion:{numerator:9,denominator:100},day7_retention:{numerator:95,denominator:100}}}));
 assert.equal(s.weeklyActiveUsers,null);assert.equal(s.progress,null);assert.equal(s.rates[0].percent,null);assert.equal(s.rates[1].percent,null);
});
test("owner gate precedes reading data and report is off by default",()=>{
 const page=read("../app/owner-hq/growth/page.tsx");
 assert.ok(page.indexOf('await requireAmbassadorSession("/owner-hq/growth",true)')<page.indexOf("process.env.HOOPCHECK_GROWTH_REPORT_JSON"));
 assert.match(page,/HOOPCHECK_GROWTH_REPORT_ENABLED==="true"/);
 assert.doesNotMatch(page,/supabase|\.insert\(|\.update\(/);
 assert.match(read("../lib/owner/metrics.ts"),/pageIndex < maxPages/);
});
