import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
function url(source){return "data:text/javascript;base64,"+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString("base64");}
const {verifiedReviewSeason,exactSeasonReviewsEnabled,listVerifiedReviewSeasons}=await import(url(read("lib/career/verified-review-season.ts").replace("./claim-input",url(read("lib/career/claim-input.ts")))));
test("exact season claims enforce caller, directory identity, dates and verified state",async()=>{
 const calls=[];let result={data:{id:"claim"},error:null};
 const db={from(table){calls.push(["table",table]);const chain={select(v){calls.push(["select",v]);return chain;},eq(...args){calls.push(args);return chain;},maybeSingle:async()=>result};return chain;}};
 const eligible=await verifiedReviewSeason(db,"player","club","womens_teams","2023-24",2026);
 assert.deepEqual(eligible,{status:200,season:"2023-2024"});
 assert.deepEqual(calls,[["table","player_team_season_claims"],["select","id"],["player_id","player"],["womens_team_id","club"],["season_start_year",2023],["season_end_year",2024],["verification_status","verified"]]);
 result={data:null,error:null};assert.equal((await verifiedReviewSeason(db,"player","club","teams","2023-24",2026)).status,403);
 result={data:null,error:{}};assert.equal((await verifiedReviewSeason(db,"player","club","teams","2023-24",2026)).status,503);
 const count=calls.length;assert.equal((await verifiedReviewSeason(db,"player","club","teams","2027",2026)).status,400);assert.equal(calls.length,count);
});
test("review routes preserve existing gates, and use canonical season before slot and insert",()=>{
 for(const [path,source] of [["app/api/reviews/route.ts","teams"],["app/api/womens-reviews/route.ts","womens_teams"]]){
  const route=read(path);
  assert.match(route,/email_confirmed_at/);
  assert.match(route,/canWriteReviews/);
  assert.match(route,/exactSeasonReviewsEnabled\(\)/);
  assert.ok(route.includes('"'+source+'"'));
  assert.ok(route.indexOf("verifiedSeason=eligibility.season")<route.indexOf('rpc("claim_review_submission_slot"'));
  assert.match(route,/player_season:verifiedSeason|playerSeason=verifiedSeason/);
 }
 const old=process.env.HOOPCHECK_EXACT_SEASON_REVIEWS_ENABLED;
 try{delete process.env.HOOPCHECK_EXACT_SEASON_REVIEWS_ENABLED;assert.equal(exactSeasonReviewsEnabled(),false);process.env.HOOPCHECK_EXACT_SEASON_REVIEWS_ENABLED="true";assert.equal(exactSeasonReviewsEnabled(),true);}
 finally{if(old===undefined)delete process.env.HOOPCHECK_EXACT_SEASON_REVIEWS_ENABLED;else process.env.HOOPCHECK_EXACT_SEASON_REVIEWS_ENABLED=old;}
});

test("review access exposes only the caller's verified season labels",async()=>{
 const calls=[];let result={data:[{season_start_year:2023,season_end_year:2024},{season_start_year:2023,season_end_year:2024},{season_start_year:2022,season_end_year:2022},{season_start_year:2027,season_end_year:2028},{season_start_year:2020,season_end_year:2025}],error:null};
 const db={from(table){calls.push(["table",table]);const chain={select(v){calls.push(["select",v]);return chain;},eq(...args){calls.push(args);return chain;},order(){return chain;},limit:async n=>{calls.push(["limit",n]);return result;}};return chain;}};
 assert.deepEqual(await listVerifiedReviewSeasons(db,"player","club","womens_teams",2026),["2023-2024","2022"]);
 assert.deepEqual(calls,[["table","player_team_season_claims"],["select","season_start_year,season_end_year"],["player_id","player"],["womens_team_id","club"],["verification_status","verified"],["limit",400]]);
 result={data:null,error:{}};await assert.rejects(()=>listVerifiedReviewSeasons(db,"player","club","teams",2026));
 const route=read("app/api/review-access/route.ts");
 assert.match(route,/user\?\.email_confirmed_at && writer\.canWriteReviews/);
 assert.match(route,/listVerifiedReviewSeasons\(scoped,user\.id,entityId/);
 assert.match(route,/exactSeasonRequired:true, verifiedSeasons/);
 assert.match(route,/canWrite=verifiedSeasons\.length>0/);
});
