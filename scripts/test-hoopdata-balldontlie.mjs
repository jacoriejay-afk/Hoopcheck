import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = name => readFileSync(new URL("../lib/" + name + ".ts", import.meta.url),"utf8");
const compile = name => ts.transpileModule(source(name),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helper={exports:{}};
new Function("exports",compile("hoopdata-ingestion"))(helper.exports);
const mod={exports:{}};
new Function("require","exports",compile("hoopdata-balldontlie"))(name=>{assert.equal(name,"./hoopdata-ingestion");return helper.exports;},mod.exports);
const {normalizeBdlGame,bdlSeasonPageUrl,parseBdlSeasonPage,resolveExistingCanonicalGame}=mod.exports;
const nba={id:42,season:2026,postseason:false,home_team:{id:1},visitor_team:{id:2},datetime:"2026-11-25T22:00:00Z",status:"Final",home_team_score:98,visitor_team_score:91};
const wnba={id:42,season:2026,postseason:true,home_team:{id:1},visitor_team:{id:2},date:"2026-09-25T22:00:00Z",status:"post",status_state:"final",home_score:87,away_score:82};
test("NBA and WNBA have distinct namespaces and lifecycle contracts",()=>{
  const n=normalizeBdlGame("nba",nba),w=normalizeBdlGame("wnba",wnba);
  assert.equal(n.provider,"balldontlie-nba");assert.equal(w.provider,"balldontlie-wnba");
  assert.equal(n.status,"final");assert.equal(w.status,"final");
  assert.equal(n.homeScore,98);assert.equal(w.awayScore,82);assert.equal(w.postseason,true);
  assert.equal(normalizeBdlGame("wnba",{...wnba,status_state:undefined}).status,"unknown");
  assert.equal(normalizeBdlGame("nba",{...nba,postponed:true}).status,"postponed");
  assert.equal(normalizeBdlGame("nba",{...nba,status:"7:00 pm ET"}).homeScore,null);
  assert.equal(normalizeBdlGame("nba",{...nba,status:"2nd Qtr"}).status,"live");
  assert.equal(normalizeBdlGame("nba",{...nba,home_team_score:91}).status,"unknown");
  assert.equal(normalizeBdlGame("nba",{...nba,home_team_score:null}).status,"unknown");
  assert.equal(normalizeBdlGame("nba",{...nba,visitor_team:{id:1}}),null);
});
test("season pages use bounded provider URLs and reject duplicate or nonadvancing pagination",()=>{
  const url=bdlSeasonPageUrl("wnba",2026,25);
  assert.equal(url.origin,"https://api.balldontlie.io");
  assert.equal(url.pathname,"/wnba/v1/games");
  assert.equal(url.searchParams.get("seasons[]"),"2026");
  assert.equal(url.searchParams.get("per_page"),"100");
  assert.equal(url.searchParams.get("cursor"),"25");
  assert.throws(()=>bdlSeasonPageUrl("nba",2026,-1));
  assert.equal(parseBdlSeasonPage("nba",2026,{data:[nba],meta:{next_cursor:50}},25).nextCursor,50);
  for (const data of [[nba,nba],[{...nba,season:2025}]]) assert.equal(parseBdlSeasonPage("nba",2026,{data,meta:{}}),null);
  assert.equal(parseBdlSeasonPage("nba",2026,{data:[nba],meta:{next_cursor:25}},25),null);
  assert.equal(parseBdlSeasonPage("nba",2026,{data:[],meta:{next_cursor:50}},25),null);
  assert.equal(parseBdlSeasonPage("nba",2026,{data:[nba],meta:{}}).nextCursor,null);
});
test("existing canonical IDs require exactly one approved provider-scoped alias",()=>{
  const fixture=normalizeBdlGame("nba",nba),id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const alias={provider:"balldontlie-nba",providerGameId:"42",canonicalGameId:id};
  assert.equal(resolveExistingCanonicalGame(fixture,[]),null);
  assert.equal(resolveExistingCanonicalGame(fixture,[{...alias,provider:"balldontlie-wnba"}]),null);
  assert.equal(resolveExistingCanonicalGame(fixture,[alias]),id);
  assert.equal(resolveExistingCanonicalGame(fixture,[alias,alias]),null);
  assert.equal(resolveExistingCanonicalGame(fixture,[{...alias,canonicalGameId:"not-a-uuid"}]),null);
});

const fetchModule={exports:{}};
new Function("require","exports",compile("hoopdata-provider-fetch"))(name=>{assert.equal(name,"./hoopdata-balldontlie");return mod.exports;},fetchModule.exports);
const {fetchBdlSeasonPage,retryAfterTime}=fetchModule.exports;
test("every request reserves shared quota, and failed reservation never invokes fetch",async()=>{
  const calls=[],now=()=>new Date("2026-11-25T12:00:00Z");
  const input={league:"nba",season:2026,apiKey:"fixture-only"};
  const deps={now,reserve:async()=>{calls.push("reserve");return false},blockUntil:async()=>{calls.push("block")},fetcher:async()=>{calls.push("fetch");return Response.json({data:[nba],meta:{}})}};
  assert.equal((await fetchBdlSeasonPage(input,deps)).state,"budget-blocked");
  assert.deepEqual(calls,["reserve"]);
  assert.equal((await fetchBdlSeasonPage(input,{...deps,reserve:async()=>{throw Error("offline")}})).state,"budget-unavailable");
  assert.deepEqual(calls,["reserve"]);
  const accepted=await fetchBdlSeasonPage(input,{...deps,reserve:async()=>{calls.push("reserve-ok");return true}});
  assert.equal(accepted.state,"ok");assert.deepEqual(calls,["reserve","reserve-ok","fetch"]);
});
test("rate limits persist Retry-After without an extra request or exposing credentials",async()=>{
  const calls=[],now=()=>new Date("2026-11-25T12:00:00Z");
  const deps={now,reserve:async()=>true,blockUntil:async(pool,until)=>calls.push([pool,until]),fetcher:async()=>{calls.push("fetch");return new Response("",{status:429,headers:{"Retry-After":"120"}})}};
  const result=await fetchBdlSeasonPage({league:"wnba",season:2026,apiKey:"fixture-only"},deps);
  assert.deepEqual(result,{state:"provider-error",status:429,retryAt:"2026-11-25T12:02:00.000Z"});
  assert.deepEqual(calls,["fetch",["balldontlie","2026-11-25T12:02:00.000Z"]]);
  assert.equal(retryAfterTime(null,now()),"2026-11-25T12:01:00.000Z");
  assert.equal(retryAfterTime("Wed, 25 Nov 2026 12:03:00 GMT",now()),"2026-11-25T12:03:00.000Z");
  assert.equal((await fetchBdlSeasonPage({league:"nba",season:2026,apiKey:"fixture-only"},{...deps,fetcher:async()=>new Response("",{status:403})})).retryAt,null);
});

const recordModule={exports:{}};
new Function("exports",compile("hoopdata-season-records"))(recordModule.exports);
const {regularSeasonRecords}=recordModule.exports;
test("provisional team records require certified coverage and exclude playoff games",()=>{
  const fixture=normalizeBdlGame("nba",nba);
  const input={provider:"balldontlie-nba",season:2026,paginationComplete:true,coverageCertified:true,fixtures:[fixture,{...fixture,id:"43",postseason:true}]};
  const summary=regularSeasonRecords(input);
  assert.equal(summary.state,"provisional");assert.equal(summary.finalGames,1);
  assert.deepEqual(summary.records,[{teamId:"1",played:1,wins:1,losses:0,pointsFor:98,pointsAgainst:91},{teamId:"2",played:1,wins:0,losses:1,pointsFor:91,pointsAgainst:98}]);
  assert.equal(regularSeasonRecords({...input,coverageCertified:false}).state,"unavailable");
  assert.equal(regularSeasonRecords({...input,paginationComplete:false}).state,"unavailable");
  assert.equal(regularSeasonRecords({...input,fixtures:[fixture,fixture]}).state,"unavailable");
  assert.equal(regularSeasonRecords({...input,fixtures:[{...fixture,postseason:null}]}).state,"unavailable");
  assert.equal(regularSeasonRecords({...input,fixtures:[{...fixture,homeScore:null}]}).state,"unavailable");
});

test("preview importer refuses production, missing credentials and the existing application DB",async()=>{
  const src=readFileSync(new URL("../app/api/cron/hoopdata-preview-import/route.ts",import.meta.url),"utf8");
  const code=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const imported={exports:{}};
  let dbCalls=0,providerCalls=0;
  new Function("require","exports",code)(name=>{
    if(name==="next/server")return {NextResponse:{json:(body,init)=>Response.json(body,init)}};
    if(name==="@supabase/supabase-js")return {createClient:()=>{dbCalls++;throw Error("unexpected DB call")}};
    if(name.includes("hoopdata-provider-fetch"))return {fetchBdlSeasonPage:()=>{providerCalls++;throw Error("unexpected provider call")}};
    throw Error(name);
  },imported.exports);
  const env={VERCEL_ENV:"production",HOOPDATA_PREVIEW_IMPORT_ENABLED:"true",HOOPDATA_PREVIEW_CRON_SECRET:"fixture-cron",HOOPDATA_ISOLATED_SUPABASE_URL:"https://fixture.invalid",HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY:"fixture-service",BALLDONTLIE_API_KEY:"fixture-provider",NEXT_PUBLIC_SUPABASE_URL:"https://fixture.invalid",SUPABASE_SERVICE_ROLE_KEY:"fixture-app-service"};
  const before=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
  const request=()=>new Request("https://fixture.invalid/api/cron/hoopdata-preview-import",{method:"POST",headers:{Authorization:"Bearer fixture-cron"},body:JSON.stringify({league:"nba",season:2026})});
  try{
    Object.assign(process.env,env);
    assert.equal((await imported.exports.POST(request())).status,404);
    process.env.VERCEL_ENV="preview";
    assert.equal((await imported.exports.POST(request())).status,503);
    process.env.HOOPDATA_ISOLATED_SUPABASE_URL="https://isolated.invalid";
    delete process.env.HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY;
    assert.equal((await imported.exports.POST(request())).status,503);
    assert.equal(dbCalls,0);assert.equal(providerCalls,0);
  }finally{for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

const fallbackModule={exports:{}};
new Function("require","exports",compile("hoopdata-fallback"))(name=>{if(name==="./hoopdata-balldontlie")return mod.exports;if(name==="./hoopdata-ingestion")return helper.exports;throw Error(name)},fallbackModule.exports);
const {fallbackScoreProposal}=fallbackModule.exports;
test("fallback proposals preserve canonical ID and existing score orientation without overriding a fresh source",()=>{
  const fixture=normalizeBdlGame("nba",{...nba,status:"2nd Qtr"});
  const gameId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",now=new Date("2026-11-25T22:30:00Z");
  const canonical={id:gameId,team_id:"away",opponent_team_id:"home",scheduled_at:fixture.tipoff,status:"live",score_updated_at:"2026-11-25T21:00:00Z",home_score:80,away_score:90};
  const input={fixture,canonical,gameAliases:[{provider:fixture.provider,providerGameId:fixture.id,canonicalGameId:gameId}],teamAliases:[{provider:fixture.provider,providerTeamId:"1",canonicalTeamId:"home"},{provider:fixture.provider,providerTeamId:"2",canonicalTeamId:"away"}],observedAt:now.toISOString(),now};
  assert.deepEqual(fallbackScoreProposal(input),{state:"candidate",canonicalGameId:gameId,homeScore:91,awayScore:98,observedAt:now.toISOString()});
  assert.equal(fallbackScoreProposal({...input,gameAliases:[]}).state,"review-required");
  assert.equal(fallbackScoreProposal({...input,teamAliases:[]}).state,"review-required");
  assert.equal(fallbackScoreProposal({...input,canonical:{...canonical,status:"final"}}).state,"not-eligible");
  assert.equal(fallbackScoreProposal({...input,canonical:{...canonical,score_updated_at:now.toISOString()}}).state,"primary-fresh");
  assert.equal(fallbackScoreProposal({...input,canonical:{...canonical,away_score:100}}).state,"review-required");
});

const competitionModule={exports:{}};
new Function("require","exports",compile("hoopdata-api-sports-competition"))(name=>{assert.equal(name,"./hoopdata-ingestion");return helper.exports},competitionModule.exports);
const competitionFetch={exports:{}};
new Function("require","exports",compile("hoopdata-competition-fetch"))(name=>{
  if(name==="./hoopdata-api-sports-competition")return competitionModule.exports;
  if(name==="./hoopdata-provider-fetch")return fetchModule.exports;
  throw Error(name);
},competitionFetch.exports);
const {fetchCompetitionSnapshot}=competitionFetch.exports;
test("international fetch reserves shared quota and preserves provider-ranked standings",async()=>{
  const calls=[],query={endpoint:"standings",league:12,season:"2025-2026"};
  const payload={get:"standings",errors:[],results:1,response:[[{league:{id:12,season:"2025-2026"},team:{id:3},position:2,stage:"Regular Season",group:{name:"Group A"},games:{played:5,win:{total:4},lose:{total:1}},points:{for:450,against:400}}]]};
  const deps={now:()=>new Date("2026-11-25T12:00:00Z"),reserve:async pool=>{calls.push(pool);return true},blockUntil:async()=>{throw Error("unexpected cooldown")},fetcher:async(url,options)=>{
    calls.push("fetch");assert.equal(url.origin,"https://v1.basketball.api-sports.io");assert.equal(url.pathname,"/standings");assert.equal(url.searchParams.get("league"),"12");assert.equal(options.redirect,"error");return Response.json(payload);
  }};
  assert.equal((await fetchCompetitionSnapshot(query,"fixture",{...deps,reserve:async()=>false})).state,"budget-blocked");
  assert.deepEqual(calls,[]);
  const result=await fetchCompetitionSnapshot(query,"fixture",deps);
  assert.equal(result.state,"ok");assert.equal(result.rows[0].position,2);assert.equal(result.rows[0].group,"Group A");assert.deepEqual(calls,["api-sports-basketball","fetch"]);
  assert.equal((await fetchCompetitionSnapshot({...query,league:13},"fixture",{...deps,fetcher:async()=>Response.json(payload)})).state,"invalid-response");
  assert.equal((await fetchCompetitionSnapshot({...query,season:"2025-2029"},"fixture",deps)).state,"invalid-query");
});
test("international fetch persists shared cooldown and rejects oversized or invalid bodies",async()=>{
  const calls=[],query={endpoint:"games",league:12,season:"2026"};
  const deps={now:()=>new Date("2026-11-25T12:00:00Z"),reserve:async()=>true,blockUntil:async(pool,until)=>calls.push([pool,until]),fetcher:async()=>new Response("",{status:429,headers:{"Retry-After":"90"}})};
  assert.deepEqual(await fetchCompetitionSnapshot(query,"fixture",deps),{state:"provider-error",status:429,retryAt:"2026-11-25T12:01:30.000Z"});
  assert.deepEqual(calls,[["api-sports-basketball","2026-11-25T12:01:30.000Z"]]);
  assert.equal((await fetchCompetitionSnapshot(query,"fixture",{...deps,fetcher:async()=>new Response(" ".repeat(4*1024*1024+1))})).state,"invalid-response");
  assert.equal((await fetchCompetitionSnapshot(query,"fixture",{...deps,fetcher:async()=>Response.json({get:"games",errors:{plan:"blocked"},results:0,response:[]})})).state,"invalid-response");
});
test("competition preview refuses production, shared credentials and unapproved targets",async()=>{
  const src=readFileSync(new URL("../app/api/cron/hoopdata-competition-preview/route.ts",import.meta.url),"utf8");
  const imported={exports:{}};let dbCalls=0,providerCalls=0;
  const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:null,error:null})};
  new Function("require","exports",ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{
    if(name==="next/server")return {NextResponse:{json:(body,init)=>Response.json(body,init)}};
    if(name==="@supabase/supabase-js")return {createClient:()=>{dbCalls++;return {from:()=>chain}}};
    if(name.includes("hoopdata-competition-fetch"))return {fetchCompetitionSnapshot:()=>{providerCalls++;throw Error("unexpected provider call")}};
    if(name.includes("hoopdata-api-sports-competition"))return competitionModule.exports;
    throw Error(name);
  },imported.exports);
  const env={VERCEL_ENV:"production",HOOPDATA_COMPETITION_PREVIEW_ENABLED:"true",HOOPDATA_PREVIEW_CRON_SECRET:"fixture-cron",HOOPDATA_ISOLATED_SUPABASE_URL:"https://isolated.invalid",HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY:"fixture-isolated",HOOPDATA_PREVIEW_API_SPORTS_KEY:"fixture-provider",NEXT_PUBLIC_SUPABASE_URL:"https://app.invalid",SUPABASE_SERVICE_ROLE_KEY:"fixture-app",API_SPORTS_BASKETBALL_KEY:"fixture-provider"};
  const before=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
  const request=()=>new Request("https://fixture.invalid",{method:"POST",headers:{Authorization:"Bearer fixture-cron"},body:JSON.stringify({endpoint:"games",league:12,season:"2026"})});
  try{
    Object.assign(process.env,env);
    assert.equal((await imported.exports.POST(request())).status,404);
    process.env.VERCEL_ENV="preview";
    assert.equal((await imported.exports.POST(request())).status,503);
    process.env.HOOPDATA_PREVIEW_API_SPORTS_KEY="fixture-separate-provider";
    assert.equal((await imported.exports.POST(request())).status,403);
    assert.equal(dbCalls,1);assert.equal(providerCalls,0);
  }finally{for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

const syncPolicy={exports:{}};
new Function("exports",compile("hoopdata-sync-policy"))(syncPolicy.exports);
const {planBasketballSync}=syncPolicy.exports;
const planNow=Date.parse("2026-11-25T12:00:00Z");
const syncJob=(id,kind,extra={})=>({id,kind,pool:"api-sports-basketball",approved:true,lastAttemptAt:null,retryAt:null,inFlight:false,...extra});
const syncQuota=(minuteRemaining,dayRemaining,extra={})=>({enabled:true,minuteRemaining,dayRemaining,blockedUntil:null,...extra});
test("sync planner prioritizes active queries, counts shared budget and independently allows another provider",()=>{
  const jobs=[syncJob("standings","standings"),syncJob("live-b","live"),syncJob("live-a","live"),syncJob("nba","schedule",{pool:"balldontlie"})];
  const pools={"api-sports-basketball":syncQuota(5,1),balldontlie:syncQuota(1,20)};
  const result=planBasketballSync(jobs,pools,planNow);
  assert.deepEqual(result.selected,["live-a","nba"]);
  assert.deepEqual(result.deferred,[{id:"live-b",reason:"quota"},{id:"standings",reason:"quota"}]);
  assert.deepEqual(planBasketballSync([...jobs].reverse(),pools,planNow).selected,result.selected);
  assert.deepEqual(planBasketballSync(jobs,pools,planNow,1).selected,["live-a"]);
});
test("sync planner skips duplicates, unapproved jobs, retries, in-flight and recent attempts",()=>{
  const jobs=[syncJob("duplicate","live"),syncJob("duplicate","schedule"),syncJob("unapproved","live",{approved:false}),syncJob("retry","live",{retryAt:planNow+1}),syncJob("running","live",{inFlight:true}),syncJob("recent","live",{lastAttemptAt:planNow-59999}),syncJob("future","live",{lastAttemptAt:planNow+1}),syncJob("due","live",{lastAttemptAt:planNow-60000})];
  const result=planBasketballSync(jobs,{"api-sports-basketball":syncQuota(20,20)},planNow);
  assert.deepEqual(result.selected,["due"]);
  assert.deepEqual(result.deferred.map(x=>x.reason),["duplicate","duplicate","unapproved","cooldown","in-flight","not-due","invalid"]);
});
test("sync planner fails closed for missing, disabled, invalid and blocked quota",()=>{
  const jobs=[syncJob("live","live")];
  for(const quota of [undefined,syncQuota(1,1,{enabled:false}),syncQuota(NaN,1),syncQuota(1,0),syncQuota(1,1,{blockedUntil:planNow+1})]){
    assert.deepEqual(planBasketballSync(jobs,{"api-sports-basketball":quota},planNow).selected,[]);
  }
  assert.throws(()=>planBasketballSync(jobs,{},planNow,21));
  assert.deepEqual(planBasketballSync(jobs,{"api-sports-basketball":syncQuota(1,1)},planNow,0).selected,[]);
});
