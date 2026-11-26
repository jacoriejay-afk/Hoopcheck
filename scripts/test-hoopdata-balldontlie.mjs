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

const dispatchModule={exports:{}};
new Function("require","exports",compile("hoopdata-sync-dispatch"))(name=>{assert.equal(name,"./hoopdata-sync-policy");return syncPolicy.exports;},dispatchModule.exports);
const {dispatchBasketballSync}=dispatchModule.exports;
test("dispatcher executes only claimed work, persists retry and stops on lost fencing",async()=>{
  const jobs=[syncJob("a","live"),syncJob("b","live"),syncJob("c","live"),syncJob("d","live")];
  const calls=[];
  const records=await dispatchBasketballSync(jobs,{"api-sports-basketball":syncQuota(4,4)},{
    now:()=>planNow,
    claim:async(job,now,leaseMs)=>{calls.push("claim:"+job.id);return job.id==="a"?null:{id:job.id,token:"lease:"+job.id,expiresAt:now+leaseMs};},
    execute:async(job,lease,signal)=>{assert.equal(lease.token,"lease:"+job.id);assert.equal(signal.aborted,false);calls.push("execute:"+job.id);return {state:"deferred",retryAt:planNow+120000};},
    finish:async(lease,outcome)=>{calls.push("finish:"+lease.id);assert.deepEqual(outcome,{state:"deferred",retryAt:planNow+120000});return lease.id==="b";}
  });
  assert.deepEqual(records,[{id:"a",state:"not-claimed"},{id:"b",state:"deferred"},{id:"c",state:"lease-lost"}]);
  assert.deepEqual(calls,["claim:a","claim:b","execute:b","finish:b","claim:c","execute:c","finish:c"]);
});
test("dispatcher stops before provider execution when claim storage fails or lease is invalid",async()=>{
  const jobs=[syncJob("a","live"),syncJob("b","live")],pools={"api-sports-basketball":syncQuota(2,2)};
  const deps={now:()=>planNow,execute:async()=>{assert.fail("unexpected provider call");},finish:async()=>{assert.fail("unexpected finish");}};
  assert.deepEqual(await dispatchBasketballSync(jobs,pools,{...deps,claim:async()=>{throw Error("database unavailable");}}),[{id:"a",state:"storage-unavailable"}]);
  assert.deepEqual(await dispatchBasketballSync(jobs,pools,{...deps,claim:async()=>({id:"a",token:"token",expiresAt:planNow+1})}),[{id:"a",state:"lease-lost"}]);
});
test("dispatcher records failure without an immediate retry and refuses expired completion",async()=>{
  const jobs=[syncJob("a","live")],pools={"api-sports-basketball":syncQuota(1,1)};
  let now=planNow,attempts=0;
  const deps={now:()=>now,claim:async(job,start,leaseMs)=>({id:job.id,token:"token",expiresAt:start+leaseMs}),execute:async()=>{attempts++;throw Error("network");},finish:async(lease,outcome)=>{assert.deepEqual(outcome,{state:"failed",retryAt:planNow+60000});return true;}};
  assert.deepEqual(await dispatchBasketballSync(jobs,pools,deps),[{id:"a",state:"failed"}]);assert.equal(attempts,1);
  assert.deepEqual(await dispatchBasketballSync(jobs,pools,{...deps,execute:async()=>{now+=60001;return {state:"staged"};},finish:async()=>{assert.fail("expired lease must not finish");}}),[{id:"a",state:"lease-lost"}]);
});

const nbaProbeModule={exports:{}};
new Function("require","exports",compile("hoopdata-nba-fallback-probe"))(name=>{
  if(name==="./hoopdata-balldontlie")return mod.exports;
  if(name==="./hoopdata-fallback")return fallbackModule.exports;
  if(name==="./hoopdata-provider-fetch")return fetchModule.exports;
  if(name==="./hoopdata-ingestion")return helper.exports;
  throw Error(name);
},nbaProbeModule.exports);
const {probeNbaFallback}=nbaProbeModule.exports;
const probeFixture={...nba,status:"2nd Qtr"};
const probeId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const probeInput={providerGameId:"42",apiKey:"fixture-only",canonical:{id:probeId,team_id:"home",opponent_team_id:"away",scheduled_at:nba.datetime,status:"live",score_updated_at:"2026-11-25T21:00:00Z",home_score:90,away_score:80},gameAliases:[{provider:"balldontlie-nba",providerGameId:"42",canonicalGameId:probeId}],teamAliases:[{provider:"balldontlie-nba",providerTeamId:"1",canonicalTeamId:"home"},{provider:"balldontlie-nba",providerTeamId:"2",canonicalTeamId:"away"}]};
const probeNow=()=>new Date("2026-11-25T22:30:00Z");
test("NBA fallback probe skips fresh or unreviewed fixtures before spending quota",async()=>{
  const calls=[];
  const deps={now:probeNow,reserve:async()=>{calls.push("reserve");return false},blockUntil:async()=>assert.fail("unexpected cooldown"),fetcher:async()=>assert.fail("unexpected fetch")};
  assert.equal((await probeNbaFallback({...probeInput,canonical:{...probeInput.canonical,score_updated_at:probeNow().toISOString()}},deps)).state,"primary-fresh");
  assert.equal((await probeNbaFallback({...probeInput,gameAliases:[]},deps)).state,"review-required");
  assert.equal((await probeNbaFallback({...probeInput,providerGameId:"../42"},deps)).state,"review-required");
  assert.deepEqual(calls,[]);
  assert.equal((await probeNbaFallback(probeInput,deps)).state,"budget-blocked");assert.deepEqual(calls,["reserve"]);
});
test("NBA fallback probe returns only a reviewed score proposal and rejects mismatched or oversized responses",async()=>{
  const calls=[];
  const deps={now:probeNow,reserve:async()=>{calls.push("reserve");return true},blockUntil:async()=>assert.fail("unexpected cooldown"),fetcher:async(url,opts)=>{calls.push("fetch");assert.equal(url.href,"https://api.balldontlie.io/v1/games/42");assert.equal(opts.redirect,"error");return Response.json({data:probeFixture});}};
  assert.deepEqual(await probeNbaFallback(probeInput,deps),{state:"candidate",canonicalGameId:probeId,homeScore:98,awayScore:91,observedAt:probeNow().toISOString()});
  assert.deepEqual(calls,["reserve","fetch"]);
  assert.equal((await probeNbaFallback(probeInput,{...deps,fetcher:async()=>Response.json({data:{...probeFixture,id:43}})})).state,"invalid-response");
  assert.equal((await probeNbaFallback(probeInput,{...deps,fetcher:async()=>new Response(" ".repeat(256*1024+1))})).state,"invalid-response");
});
test("NBA fallback probe persists provider cooldown and does not retry",async()=>{
  let attempts=0;const blocks=[];
  const deps={now:probeNow,reserve:async()=>true,blockUntil:async(pool,until)=>blocks.push([pool,until]),fetcher:async()=>{attempts++;return new Response("",{status:429,headers:{"Retry-After":"120"}});}};
  assert.deepEqual(await probeNbaFallback(probeInput,deps),{state:"provider-error",status:429,retryAt:"2026-11-25T22:32:00.000Z"});
  assert.deepEqual(blocks,[["balldontlie","2026-11-25T22:32:00.000Z"]]);assert.equal(attempts,1);
});

const liveCadenceModule={exports:{}};
new Function("exports",compile("hoopdata-live-cadence"))(liveCadenceModule.exports);
const {planLiveCadence}=liveCadenceModule.exports;
const cadenceNow=Date.parse("2026-11-25T12:00:00Z"), cadenceMinute=60000;
const cadenceInput={now:cadenceNow,enabled:true,dayLimit:100,usedLast24Hours:80,protectedOtherRequests:8,minIntervalMinutes:1,windows:[{start:cadenceNow,end:cadenceNow+60*cadenceMinute}]};
test("live cadence preserves protected requests and fits verified capacity",()=>{
  const r=planLiveCadence(cadenceInput);
  assert.equal(r.state,"planned");assert.equal(r.intervalMinutes,5);
  assert.equal(r.availableRequests,12);assert.equal(r.slots.length,12);assert.equal(r.unallocatedRequests,0);
  assert.equal(r.slots[0],cadenceNow);
  assert.equal(r.slots[11],cadenceNow+55*cadenceMinute);
  const one=planLiveCadence({...cadenceInput,dayLimit:89});
  assert.equal(one.state,"planned");assert.equal(one.slots.length,1);
});
test("live cadence merges overlapping windows and excludes inactive or out-of-horizon minutes",()=>{
  const windows=[{start:cadenceNow-5*cadenceMinute,end:cadenceNow+5*cadenceMinute},{start:cadenceNow+3*cadenceMinute,end:cadenceNow+8*cadenceMinute},{start:cadenceNow+10*cadenceMinute,end:cadenceNow+12*cadenceMinute},{start:cadenceNow+1440*cadenceMinute,end:cadenceNow+1445*cadenceMinute}];
  const r=planLiveCadence({...cadenceInput,windows});
  assert.equal(r.state,"planned");assert.equal(r.intervalMinutes,1);
  assert.deepEqual(r.slots,[0,1,2,3,4,5,6,7,10,11].map(n=>cadenceNow+n*cadenceMinute));
  assert.equal(new Set(r.slots).size,r.slots.length);
});
test("live cadence fails closed for missing capacity, disabled plans and malformed windows",()=>{
  assert.equal(planLiveCadence({...cadenceInput,enabled:false}).state,"disabled");
  assert.equal(planLiveCadence({...cadenceInput,dayLimit:88}).state,"no-capacity");
  assert.equal(planLiveCadence({...cadenceInput,windows:[]}).state,"no-active-window");
  assert.equal(planLiveCadence({...cadenceInput,windows:[{start:cadenceNow,end:cadenceNow}]}).state,"invalid");
  assert.equal(planLiveCadence({...cadenceInput,minIntervalMinutes:0}).state,"invalid");
  assert.equal(planLiveCadence({...cadenceInput,dayLimit:NaN}).state,"invalid");
});

const rightsModule={exports:{}};
new Function("exports",compile("hoopdata-provider-rights"))(rightsModule.exports);
const wnbaProbeModule={exports:{}};
new Function("require","exports",compile("hoopdata-wnba-fallback-probe"))(name=>{
 const modules={"./hoopdata-balldontlie":mod.exports,"./hoopdata-fallback":fallbackModule.exports,"./hoopdata-nba-fallback-probe":nbaProbeModule.exports,"./hoopdata-provider-fetch":fetchModule.exports,"./hoopdata-ingestion":helper.exports,"./hoopdata-provider-rights":rightsModule.exports};
 if(!Object.hasOwn(modules,name))throw Error(name);
 return modules[name];
},wnbaProbeModule.exports);
const {probeWnbaFallback}=wnbaProbeModule.exports;
const wnbaNow=()=>new Date("2026-09-25T22:30:00Z");
const wnbaRights={provider:"balldontlie",competitionId:"wnba",kind:"scores",plan:"reviewed-pilot",evidenceRef:"synthetic-grant",reviewerId:"synthetic-reviewer",reviewedAt:"2026-09-24T00:00:00Z",validUntil:"2026-09-26T00:00:00Z",uses:["evaluate"],status:"approved",retentionHours:0,attribution:"fixture",upstreamRightsConfirmed:true,artworkPermissionConfirmed:false,appStorePermissionConfirmed:false};
const wnbaInput={...probeInput,providerDate:"2026-09-25",season:2026,plan:"reviewed-pilot",rights:[wnbaRights],canonical:{...probeInput.canonical,scheduled_at:wnba.date,score_updated_at:"2026-09-25T21:00:00Z",home_score:80,away_score:75},gameAliases:probeInput.gameAliases.map(a=>({...a,provider:"balldontlie-wnba"})),teamAliases:probeInput.teamAliases.map(a=>({...a,provider:"balldontlie-wnba"}))};
const wnbaLive={...wnba,status_state:"in_progress"};
test("WNBA fallback requires current rights and reviewed aliases before quota or network work",async()=>{
 let calls=0;
 const deps={now:wnbaNow,reserve:async()=>{calls++;return false},blockUntil:async()=>assert.fail("unexpected cooldown"),fetcher:async()=>assert.fail("unexpected fetch")};
 assert.equal((await probeWnbaFallback({...wnbaInput,rights:[]},deps)).state,"rights-blocked");
 assert.equal((await probeWnbaFallback({...wnbaInput,rights:[{...wnbaRights,status:"revoked"}]},deps)).state,"rights-blocked");
 assert.equal((await probeWnbaFallback({...wnbaInput,gameAliases:probeInput.gameAliases},deps)).state,"review-required");
 assert.equal((await probeWnbaFallback({...wnbaInput,providerDate:"2026-09-31"},deps)).state,"review-required");
 assert.equal(calls,0);
 assert.equal((await probeWnbaFallback(wnbaInput,deps)).state,"budget-blocked");assert.equal(calls,1);
});
test("WNBA fallback uses one documented date-filtered page and rejects ambiguous and final data",async()=>{
 const calls=[];
 const deps={now:wnbaNow,reserve:async()=>{calls.push("reserve");return true},blockUntil:async()=>assert.fail("unexpected cooldown"),fetcher:async(url,opts)=>{
  calls.push("fetch");assert.equal(url.origin,"https://api.balldontlie.io");assert.equal(url.pathname,"/wnba/v1/games");assert.equal(url.searchParams.get("dates[]"),"2026-09-25");assert.equal(url.searchParams.get("seasons[]"),"2026");assert.equal(opts.redirect,"error");return Response.json({data:[wnbaLive],meta:{}});
 }};
 assert.deepEqual(await probeWnbaFallback(wnbaInput,deps),{state:"candidate",canonicalGameId:probeId,homeScore:87,awayScore:82,observedAt:wnbaNow().toISOString()});
 assert.deepEqual(calls,["reserve","fetch"]);
 for(const payload of [{data:[wnbaLive,wnbaLive],meta:{}},{data:[wnbaLive],meta:{next_cursor:3}}])assert.equal((await probeWnbaFallback(wnbaInput,{...deps,fetcher:async()=>Response.json(payload)})).state,"invalid-response");
 assert.equal((await probeWnbaFallback(wnbaInput,{...deps,fetcher:async()=>Response.json({data:[wnba],meta:{}})})).state,"not-eligible");
 assert.equal((await probeWnbaFallback(wnbaInput,{...deps,fetcher:async()=>Response.json({data:[{...wnbaLive,id:43}],meta:{}})})).state,"review-required");
 assert.equal((await probeWnbaFallback(wnbaInput,{...deps,fetcher:async()=>new Response(" ".repeat(256*1024+1))})).state,"invalid-response");
});

const syncRightsModule={exports:{}};
new Function("require","exports",compile("hoopdata-sync-rights"))(name=>{assert.equal(name,"./hoopdata-provider-rights");return rightsModule.exports;},syncRightsModule.exports);
test("automatic competition refresh requires both evaluation and full bounded cache permission",()=>{
 const now=new Date("2026-11-25T12:00:00Z"),leagueId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 const task={kind:"standings",mapping:{leagueId,providerLeagueId:12,side:"womens",reviewed:true,evidence:"fixture"},season:"2026-2027"};
 const grant={provider:"api-sports",competitionId:leagueId,kind:"standings",plan:"pilot",uses:["evaluate","cache"],status:"approved",evidenceRef:"fixture",reviewerId:"operator",reviewedAt:"2026-11-24T12:00:00Z",validUntil:"2026-12-01T12:00:00Z",retentionHours:1,upstreamRightsConfirmed:true,artworkPermissionConfirmed:false,appStorePermissionConfirmed:false,attribution:"API-Sports"};
 const check=(grants)=>syncRightsModule.exports.authorizeCompetitionRefresh(task,"pilot",grants,now);
 assert.deepEqual(check([grant]),{hours:1,expiresAt:"2026-11-25T13:00:00.000Z"});
 for(const rows of [[],[grant,grant],[{...grant,uses:["evaluate"]}],[{...grant,uses:["cache"]}],[{...grant,retentionHours:0.5}],[{...grant,validUntil:"2026-11-25T12:30:00Z"}],[{...grant,status:"revoked"}]])assert.equal(check(rows),null);
 assert.equal(syncRightsModule.exports.authorizeCompetitionRefresh({...task,kind:"games"},"pilot",[grant],now),null);
});
const strictRefreshModule={exports:{}};
new Function("require","exports",compile("hoopdata-competition-refresh"))(name=>{
 if(name==="./hoopdata-api-sports-competition")return competitionModule.exports;
 if(name==="./hoopdata-competition-worker")return {reviewedCompetitionMapping:()=>true};
 throw Error(name);
},strictRefreshModule.exports);
test("automatic refresh never treats unknown provider capability as supported and defers rights-blocked jobs",async()=>{
 const leagueId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",mapping={leagueId,providerLeagueId:12,side:"womens",reviewed:true,evidence:"fixture"},season={season:"2026-2027",start:"2026-10-01",end:"2027-06-01",games:null,standings:true},job={leagueId,mapping,kind:"games",leaseToken:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",seasonRows:[season]};
 const outcomes=[],deps={now:()=>new Date("2026-11-25T12:00:00Z"),claim:async()=>job,execute:async()=>assert.fail("unknown support must not fetch"),finish:async(_c,o)=>{outcomes.push(o);return true}};
 assert.equal((await strictRefreshModule.exports.runCompetitionRefreshTick(deps)).state,"deferred");
 assert.deepEqual(outcomes.pop(),{state:"deferred",reason:"active-season-or-coverage-unconfirmed"});
 assert.equal((await strictRefreshModule.exports.runCompetitionRefreshTick({...deps,claim:async()=>({...job,seasonRows:[{...season,games:true}]}),execute:async()=>({state:"rights-blocked"})})).state,"deferred");
 assert.deepEqual(outcomes.pop(),{state:"deferred",reason:"rights-blocked"});
});
