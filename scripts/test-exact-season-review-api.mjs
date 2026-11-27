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

test("published review attribution is server-only, scoped, and fail closed", async () => {
 const { NextResponse } = await import("next/server.js");
 const page=read("app/reviews/page.tsx");
 assert.match(page,/fetch\("\/api\/reviews\/published"/);
 assert.doesNotMatch(page,/\.from\("reviews"\)/);
 assert.match(page,/item\.is_anonymous \? "Anonymous reviewer"/);
 const source=ts.transpileModule(read("app/api/reviews/published/route.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const sample of [{denied:true},{scopeError:true},{authorError:true},{}]){
  const calls=[];
  const data=[{id:"anonymous",status:"approved",is_anonymous:true,author_id:"never-return"},{id:"named",status:"approved",is_anonymous:false},{id:"changed",status:"approved",is_anonymous:false},{id:"unknown",status:"approved",is_anonymous:null}];
  const scoped={from:table=>{assert.equal(table,"reviews");const q={select:cols=>{assert.doesNotMatch(cols,/author_id/);return q;},eq:(...args)=>{assert.deepEqual(args,["status","approved"]);return q;},order:()=>q,limit:async n=>{assert.equal(n,100);return {data,error:sample.scopeError?Error():null};}};return q;}};
  const service={from:table=>{assert.equal(table,"reviews");const q={select:cols=>{assert.equal(cols,"id,author_id,is_anonymous");return q;},in:(key,ids)=>{assert.equal(key,"id");assert.deepEqual(ids,["named","changed"]);return q;},eq:(...args)=>{calls.push(args);if(args[0]==="status")return q;return Promise.resolve({data:[{id:"named",is_anonymous:false,author_id:"named-author"},{id:"changed",is_anonymous:true,author_id:"hidden"},{id:"outside",is_anonymous:false,author_id:"outside"}],error:sample.authorError?Error():null});}};return q;}};
  const route={};
  new Function("require","exports",source)(name=>name==="next/server"?{NextResponse}:{authenticateModerationRequest:async()=>sample.denied?{ok:false,response:NextResponse.json({}, {status:403})}:{ok:true,scoped,supabase:service}},route);
  const response=await route.GET(new Request("https://fixture.invalid/api/reviews/published?ids=outside"));
  assert.match(response.headers.get("Cache-Control"),/no-store/);
  assert.equal(response.status,sample.denied?403:sample.scopeError||sample.authorError?503:200);
  if(sample.denied||sample.scopeError)assert.deepEqual(calls,[]);
  else assert.deepEqual(calls,[["status","approved"],["is_anonymous",false]]);
  if(response.ok){const body=await response.json();assert.deepEqual(body.reviews.map(r=>r.author_id),[null,"named-author",null,null]);assert.equal(body.reviews[3].is_anonymous,true);}
 }
});

test("review access performs live authorization before using service credentials", async () => {
 const { NextResponse } = await import("next/server.js");
 const owner = "11111111-1111-4111-8111-111111111111";
 const target = "22222222-2222-4222-8222-222222222222";
 const project = "https://fixture.invalid";
 const appEnv = { NEXT_PUBLIC_SUPABASE_URL: project, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public", SUPABASE_SERVICE_ROLE_KEY: "service" };
 const { getHoopCheckEntitlements } = await import(url(read("lib/membership-tier.ts")));
 const { assuranceForVerifiedUser } = await import(url(read("lib/auth/mfa-core.ts")));
 for (const sample of [
  {guest:true, status:200},
  {invalid:true, status:401},
  {mfa:true, status:403},
  {active:false, status:403},
  {suspended:true, status:403},
  {dbError:true, status:503},
  {plan:"pro", status:200, projection:"overall_rating"},
  {plan:"premium", status:200, projection:"full"},
 ]) {
  const projections = [];
  const token = "fixture." + Buffer.from(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+600,aal:"aal1"})).toString("base64url") + ".fixture";
  const createClient = (origin,key,options) => {
   assert.equal(origin, project);
   if (key === "service") {
    assert.ok(sample.projection, "Denied callers cannot obtain a service query");
    return {from:table => {
     assert.equal(table,"reviews");
     const query = {select:columns => {projections.push(columns);return query;},eq:()=>query,order:async()=>({data:[]})};
     return query;
    }};
   }
   assert.equal(options.global.headers.Authorization,"Bearer "+token);
   return {
    auth:{getUser:async supplied => {
     assert.equal(supplied,token);
     const verified = {id:owner,email_confirmed_at:"2026-01-01",factors:sample.mfa?[{id:target,factor_type:"totp",status:"verified"}]:[]};
     return {data:{user:sample.invalid?null:verified}};
    }},
    from:table=>{
     const result = table==="profiles" ? {data:{account_type:"fan",moderation_status:sample.suspended?"suspended":"normal"}}
      : {data:{plan:sample.plan,status:"active"},error:sample.dbError?Error("lookup failed"):null};
     const query = {select:()=>query,eq:(key,id)=>{
      assert.equal(key,table==="profiles"?"id":"user_id");
      assert.equal(id,owner);
      return query;
     },maybeSingle:async()=>result};
     return query;
    },
    rpc:async name=>({data:name==="confirm_active_account_session"?sample.active!==false:false}),
   };
  };
  const source = ts.transpileModule(read("app/api/review-access/route.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const imports = {
   "next/server":{NextResponse},
   "@supabase/supabase-js":{createClient},
   "../../../lib/review-summary":{calculateReviewSummary:()=>({})},
   "../../../lib/membership-tier":{getHoopCheckEntitlements},
   "../../../lib/career/verified-review-season":{exactSeasonReviewsEnabled:()=>false},
   "../../../lib/auth/mfa-core":{assuranceForVerifiedUser},
  };
  const route = {};
  new Function("require","exports","process",source)(name=>imports[name],route,{env:appEnv});
  const response = await route.GET(new Request(project + "/api/review-access?entityType=coach&entityId=" + target,
   {headers:sample.guest?{}:{Authorization:"Bearer "+token}}));
  assert.equal(response.status,sample.status);
  assert.match(response.headers.get("Cache-Control"),/no-store/);
  if (sample.projection==="overall_rating") assert.deepEqual(projections,["overall_rating"]);
  if (sample.projection==="full") {
   assert.equal(projections.length,1);
   assert.match(projections[0],/is_anonymous/);
   assert.doesNotMatch(projections[0],/author_id/);
  }
 }
});

test("staff review queue requires moderator authorization and preserves scoped IDs", async () => {
 const { NextResponse } = await import("next/server.js");
 const page=read("app/admin/reviews/page.tsx");
 assert.match(page,/fetch\("\/api\/admin\/reviews"/);
 assert.doesNotMatch(page,/\.from\("reviews"\)/);
 assert.match(page,/current !== accountGeneration.current/);
 const source=ts.transpileModule(read("app/api/admin/reviews/route.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const sample of [{denied:true},{scopeError:true},{authorError:true},{empty:true},{}]){
  const seen=[];
  const data=sample.empty?[]:[{id:"visible",status:"pending",author_id:"do-not-trust",secret:"not-in-projection"}];
  const scoped={from:table=>{seen.push("scope");assert.equal(table,"reviews");const q={select:cols=>{assert.doesNotMatch(cols,/author_id/);return q;},order:()=>q,limit:async n=>{assert.equal(n,1000);return {data,error:sample.scopeError?Error():null};}};return q;}};
  const service={from:table=>{seen.push("service");assert.equal(table,"reviews");return {select:cols=>{assert.equal(cols,"id,author_id");return {in:async (key,ids)=>{assert.equal(key,"id");assert.deepEqual(ids,["visible"]);return {data:[{id:"visible",author_id:"verified"},{id:"outside",author_id:"private"}],error:sample.authorError?Error():null};}};}};}};
  const route={};
  new Function("require","exports",source)(name=>name==="next/server"?{NextResponse}:{authorizeModeratorRequest:async()=>sample.denied?{ok:false,response:NextResponse.json({}, {status:403})}:{ok:true,scoped,supabase:service}},route);
  const response=await route.GET(new Request("https://fixture.invalid/api/admin/reviews?ids=outside"));
  assert.match(response.headers.get("Cache-Control"),/no-store/);
  assert.equal(response.status,sample.denied?403:sample.scopeError||sample.authorError?503:200);
  assert.deepEqual(seen,sample.denied?[]:sample.scopeError||sample.empty?["scope"]:["scope","service"]);
  if(response.ok){const body=await response.json();assert.deepEqual(body.reviews.map(r=>r.author_id),sample.empty?[]:["verified"]);assert.equal(body.reviews.some(r=>"secret" in r),false);}
 }
});
