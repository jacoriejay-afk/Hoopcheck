import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../lib/career/claim-input.ts",import.meta.url),"utf8");
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseCareerSeason,careerClaimTarget}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
test("equivalent season spellings normalize to the same canonical key",()=>{
 for(const spelling of ["2023-24","2023-2024","2023–24","2023/24"," 2023 - 2024 "]) assert.deepEqual(parseCareerSeason(spelling,2026),{startYear:2023,endYear:2024,label:"2023-2024"});
 assert.deepEqual(parseCareerSeason("1999-00",2026),{startYear:1999,endYear:2000,label:"1999-2000"});
 assert.deepEqual(parseCareerSeason("2024",2026),{startYear:2024,endYear:2024,label:"2024"});
});
test("invalid, ambiguous, future or multi-season inputs are denied",()=>{
 for(const invalid of [null,2024,"2027","2024-2022","2024-25-26","2022-2025","2024-24","1899","24-25","2023 season"]) assert.equal(parseCareerSeason(invalid,2026),null,String(invalid));
});
test("team claims retain explicit directory identity and never use names",()=>{
 const id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
 assert.deepEqual(careerClaimTarget({id,source:"teams"}),{team_id:id,womens_team_id:null});
 assert.deepEqual(careerClaimTarget({id,source:"womens_teams"}),{team_id:null,womens_team_id:id});
 for(const invalid of [null,{id:"Club Name",source:"teams"},{id,source:"other"}]) assert.equal(careerClaimTarget(invalid),null);
});
