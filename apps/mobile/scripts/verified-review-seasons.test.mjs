import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../src/native/verifiedReviewSeasons.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {verifiedSeasonChoices,nativeReviewTarget,readNativeVerifiedSeasons}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
test("verified native choices reject legacy access and invalid seasons",()=>{
 const access={exactSeasonRequired:true,canWrite:true,verifiedSeasons:["2023-2024","2022","2023-2024"]};
 assert.deepEqual(verifiedSeasonChoices(access,2026),["2023-2024","2022"]);
 assert.deepEqual(verifiedSeasonChoices({...access,canWrite:false},2026),[]);
 for(const data of [{...access,exactSeasonRequired:false},{...access,verifiedSeasons:["2023-24"]},{...access,verifiedSeasons:["2027"]},{...access,verifiedSeasons:["2021-2025"]}])assert.throws(()=>verifiedSeasonChoices(data,2026));
});
test("native women and men have distinct review targets",()=>{
 assert.deepEqual(nativeReviewTarget("womens-team",id),{path:"/api/womens-reviews",payload:{womens_team_id:id}});
 assert.deepEqual(nativeReviewTarget("team",id),{path:"/api/reviews",payload:{team_id:id}});
 assert.throws(()=>nativeReviewTarget("team","invalid"));
});
test("native eligibility request does not send private data to an untrusted origin",async()=>{
 let call;
 const request=async(url,opts)=>{call={url,opts};return new Response(JSON.stringify({exactSeasonRequired:true,canWrite:true,verifiedSeasons:["2023-2024"]}));};
 assert.deepEqual(await readNativeVerifiedSeasons("https://hoopcheck.online","fixture",id,"womens-team",undefined,request),["2023-2024"]);
 assert.equal(new URL(call.url).searchParams.get("entityType"),"womens-team");
 assert.equal(call.opts.headers.Authorization,"Bearer fixture");
 assert.equal(call.opts.cache,"no-store");assert.equal(call.opts.redirect,"error");
 await assert.rejects(()=>readNativeVerifiedSeasons("http://hoopcheck.online","fixture",id,"team",undefined,request));
});
test("form uses verified scope and correct team endpoint",()=>{
 const form=readFileSync(new URL("../app/teams/[id]/review.tsx",import.meta.url),"utf8");
 const women=readFileSync(new URL("../app/womens/[id].tsx",import.meta.url),"utf8");
 assert.match(form,/currentChoices\.seasons\.includes\(season\)/);
 assert.match(form,/data\.session\?\.user\.id!==currentChoices\?\.userId/);
 assert.match(form,/\.\.\.target\.payload/);
 assert.match(women,/nativeExactSeasonReviewsEnabled\?router\.push/);
});
