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
