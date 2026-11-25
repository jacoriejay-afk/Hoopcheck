import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const code = ts.transpileModule(read("lib/hoopdata-ingestion.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { validateProviderSnapshot, validatedProviderScore, providerTipoff, scoreSnapshotFreshness } =
  await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
test("provider duplicates are rejected even when numeric and string IDs differ in representation", () => {
  assert.equal(validateProviderSnapshot([{id:1},{id:"2"}]), true);
  assert.equal(validateProviderSnapshot([{id:1},{id:"1"}]), false);
  for (const row of [null,{}, {id:0}, {id:-1}, {id:1.5}, {id:""}, {id:"001"}, {id:NaN}]) {
    assert.equal(validateProviderSnapshot([row]), false);
  }
  assert.equal(validateProviderSnapshot([]), true);
});
test("unknown, negative, fractional and nonfinite scores are never displayed as zero", () => {
  assert.equal(validatedProviderScore(0), 0);
  assert.equal(validatedProviderScore(87), 87);
  for (const value of [null, undefined, -1, 2.5, Infinity, NaN, "0"]) assert.equal(validatedProviderScore(value), null);
});
test("tip-offs use an explicit UTC instant or timezone offset only", () => {
  assert.equal(providerTipoff(1795608000, null), new Date(1795608000000).toISOString());
  assert.equal(providerTipoff(null,"2026-11-25T20:00:00+04:00"), "2026-11-25T16:00:00.000Z");
  assert.equal(providerTipoff(null,"2026-11-25T20:00:00"), null);
  assert.equal(providerTipoff(Number.MAX_SAFE_INTEGER,"invalid"), null);
  assert.equal(providerTipoff(null,"2026-11-25"), null);
});
test("snapshot freshness is delayed after 25 minutes; missing or future data is unknown", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  assert.equal(scoreSnapshotFreshness("2026-11-25T11:35:00Z",now), "fresh");
  assert.equal(scoreSnapshotFreshness("2026-11-25T11:34:59Z",now), "delayed");
  for (const stamp of [null,undefined,"invalid","2026-11-25T12:01:00Z"]) assert.equal(scoreSnapshotFreshness(stamp,now),"unknown");
});
test("ingestion rejects duplicate snapshots before writes and preserves distinct terminal states", () => {
  const route = read("app/api/cron/live-basketball/route.ts");
  assert.ok(route.indexOf("validateProviderSnapshot(payload.response)") < route.indexOf('.insert(newMappings)'));
  assert.ok(route.includes('providerStatus === "POST" || providerStatus === "SUSP" ? "postponed"'));
  assert.ok(route.includes('providerStatus === "ABD" ? "abandoned"'));
  assert.ok(route.includes("if (!startDate) continue"));
  assert.ok(route.includes('upsert(rows, { onConflict: "provider_source,provider_game_id" })'));
  assert.equal((route.match(/await fetch\(/g)||[]).length,1);
});
test("live games distinguish source freshness from UI refresh and support legacy schema", () => {
  const hub = read("app/live-games/page.tsx");
  assert.ok(hub.includes('gameFields + ",score_updated_at"'));
  assert.ok(hub.includes('result.error?.code === "42703" ? readGames(gameFields) : result'));
  assert.ok(hub.includes("Score update delayed"));
  assert.ok(hub.includes("Score freshness unavailable"));
});

test("Basketball Data Center uses verified owner access before any privileged reads",()=>{
  const page=read("app/owner-hq/basketball-data/page.tsx");
  assert.ok(page.indexOf('await requireAmbassadorSession("/owner-hq/basketball-data",true)')>0);
  assert.ok(page.indexOf('await requireAmbassadorSession("/owner-hq/basketball-data",true)')<page.indexOf("const db="));
  assert.ok(page.includes("Unavailable"));
  assert.ok(page.includes("Directory counts are not verified provider coverage"));
  assert.doesNotMatch(page,/\.insert\(|\.upsert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test("primary score ingestion only invokes provider after optional durable quota reservation",()=>{
  const route=read("app/api/cron/live-basketball/route.ts");
  assert.ok(route.includes('process.env.HOOPDATA_QUOTA_GUARD_ENABLED === "true"'));
  const reserve=route.indexOf('await db.rpc("hoopdata_reserve_request"');
  const fetchAt=route.indexOf("await fetch(");
  assert.ok(reserve>0&&reserve<fetchAt);
  assert.ok(route.indexOf("if (reserved !== true)")<fetchAt);
  assert.ok(route.includes('await persistCooldown(response.headers.get("Retry-After"))'));
  assert.ok(route.includes('await persistCooldown(null)'));
});

const competitionModule={exports:{}};
const ingestionModule={exports:{}};
const cjsOptions={compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}};
new Function("exports",ts.transpileModule(read("lib/hoopdata-ingestion.ts"),cjsOptions).outputText)(ingestionModule.exports);
new Function("require","exports",ts.transpileModule(read("lib/hoopdata-api-sports-competition.ts"),cjsOptions).outputText)(name=>{assert.equal(name,"./hoopdata-ingestion");return ingestionModule.exports;},competitionModule.exports);
const {apiSportsCompetitionUrl,parseApiSportsSeasonGames,parseApiSportsStandings,parseApiSportsCompetitionSeasons,selectActiveCompetitionSeason}=competitionModule.exports;
const envelope=(get,response)=>({get,response,errors:[],results:response.length});
test("international provider competition endpoints use explicit league and season and UTC",()=>{
  assert.equal(apiSportsCompetitionUrl("games",12,"2026-2027").searchParams.get("timezone"),"UTC");
  assert.equal(apiSportsCompetitionUrl("standings",12,"2026").searchParams.get("league"),"12");
  assert.equal(apiSportsCompetitionUrl("leagues",12).searchParams.has("season"),false);
  assert.throws(()=>apiSportsCompetitionUrl("games",12));
  assert.throws(()=>apiSportsCompetitionUrl("games",12,"2026-2028"));
});
test("season fixtures reject duplicate or mismatched IDs and malformed final scores",()=>{
  const game={id:1,league:{id:12,season:"2026-2027"},teams:{home:{id:2},away:{id:3}},date:"2026-11-25T19:00:00Z",status:{short:"FT"},scores:{home:{total:90},away:{total:80}}};
  const parsed=parseApiSportsSeasonGames(envelope("games",[game]),12,"2026-2027");
  assert.equal(parsed[0].status,"final");assert.equal(parsed[0].homeScore,90);
  assert.equal(parseApiSportsSeasonGames(envelope("games",[game,game]),12,"2026-2027"),null);
  assert.equal(parseApiSportsSeasonGames(envelope("games",[game]),13,"2026-2027"),null);
  assert.equal(parseApiSportsSeasonGames(envelope("games",[{...game,scores:{home:{total:90},away:{total:90}}}]),12,"2026-2027"),null);
  assert.equal(parseApiSportsSeasonGames({...envelope("games",[game]),errors:{requests:"quota"}},12,"2026-2027"),null);
});
test("official provider ranking preserves separate stages and groups rather than recomputing rank",()=>{
  const row={league:{id:12,season:"2026-2027"},team:{id:2},position:3,stage:"Regular",group:{name:"Eastern"},games:{played:5,win:{total:3},lose:{total:2}},points:{for:450,against:430}};
  const rows=parseApiSportsStandings(envelope("standings",[[row],[{...row,group:{name:"Atlantic"},position:1}]]),12,"2026-2027");
  assert.equal(rows.length,2);assert.equal(rows[0].position,3);assert.equal(rows[1].position,1);
  assert.equal(parseApiSportsStandings(envelope("standings",[[row,row]]),12,"2026-2027"),null);
});
test("season rollover requires unique verified provider date window",()=>{
  const raw=envelope("leagues",[{id:12,seasons:[{season:"2026-2027",start:"2026-10-01",end:"2027-06-01",coverage:{standings:true,games:{statistics:{teams:true}}}},{season:"2027-2028",start:"2027-10-01",end:"2028-06-01"}]}]);
  const seasons=parseApiSportsCompetitionSeasons(raw,12);
  assert.equal(seasons[0].standings,true);assert.equal(seasons[0].games,null);
  assert.equal(selectActiveCompetitionSeason(seasons,"2026-11-25"),"2026-2027");
  assert.equal(selectActiveCompetitionSeason(seasons,"2027-07-01"),null);
  assert.equal(selectActiveCompetitionSeason([seasons[0],seasons[0]],"2026-11-25"),null);
});

const competitionFetchModule={exports:{}};
new Function("require","exports",ts.transpileModule(read("lib/hoopdata-competition-fetch.ts"),cjsOptions).outputText)(name=>{
  if(name==="./hoopdata-api-sports-competition")return competitionModule.exports;
  if(name==="./hoopdata-provider-fetch")return {retryAfterTime:()=> "2026-11-25T13:01:00.000Z"};
  throw Error(name);
},competitionFetchModule.exports);
const competitionWorkerModule={exports:{}};
new Function("require","exports",ts.transpileModule(read("lib/hoopdata-competition-worker.ts"),cjsOptions).outputText)(name=>{
  if(name==="./hoopdata-api-sports-competition")return competitionModule.exports;
  if(name==="./hoopdata-competition-fetch")return competitionFetchModule.exports;
  throw Error(name);
},competitionWorkerModule.exports);
const {runCompetitionTask}=competitionWorkerModule.exports;
test("competition worker requires reviewed identity, reserves budget before fetching, and stages only validated data",async()=>{
  const mapping={leagueId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",providerLeagueId:12,side:"womens",reviewed:true,evidence:"verified competition fixture"};
  const task={kind:"seasons",mapping};
  const operations=[];
  const deps={now:()=>new Date("2026-11-25T13:00:00Z"),reserve:async()=>{operations.push("reserve");return true},blockUntil:async()=>{operations.push("cooldown")},fetcher:async(url,init)=>{operations.push("fetch");assert.equal(url.hostname,"v1.basketball.api-sports.io");assert.equal(init.redirect,"error");return Response.json(envelope("leagues",[{id:12,seasons:[{season:"2026-2027",start:"2026-10-01",end:"2027-06-01"}]}]))},stage:async(snapshot)=>{operations.push("stage");assert.equal(snapshot.mapping.side,"womens");assert.equal(snapshot.rows[0].season,"2026-2027");return true}};
  assert.equal((await runCompetitionTask({...task,mapping:{...mapping,reviewed:false}},"test",deps)).state,"mapping-required");
  assert.deepEqual(operations,[]);
  assert.equal((await runCompetitionTask(task,"test",{...deps,reserve:async()=>false})).state,"budget-blocked");
  assert.deepEqual(operations,[]);
  assert.equal((await runCompetitionTask(task,"test",deps)).state,"staged");
  assert.deepEqual(operations,["reserve","fetch","stage"]);
  operations.length=0;
  assert.equal((await runCompetitionTask(task,"test",{...deps,fetcher:async()=>Response.json(envelope("leagues",[]))})).state,"invalid-response");
  assert.deepEqual(operations,["reserve"]);
  assert.equal((await runCompetitionTask(task,"test",{...deps,fetcher:async()=>new Response(null,{status:429})})).state,"provider-error");
  assert.deepEqual(operations,["reserve","reserve","cooldown"]);
  assert.equal((await runCompetitionTask(task,"test",{...deps,stage:async()=>false})).state,"stage-failed");
});

test("mapped competition preview cannot activate in production or use primary credentials",()=>{
  const route=read("app/api/cron/hoopdata-mapped-competition-preview/route.ts");
  const gate=route.indexOf('process.env.VERCEL_ENV!=="preview"');
  const auth=route.indexOf('request.headers.get("authorization")');
  const database=route.indexOf("const db=createClient");
  assert.ok(gate>0&&gate<auth&&auth<database);
  assert.ok(route.indexOf("key===appKey||providerKey===appProvider")<database);
  assert.ok(route.includes('new URL(url).origin===new URL(appUrl).origin'));
  assert.ok(route.indexOf('.eq("reviewed",true)')<route.indexOf("await runCompetitionTask"));
  assert.ok(route.indexOf('league.basketball_type!==m.side')<route.indexOf("await runCompetitionTask"));
  assert.ok(route.includes("canonicalWrites:false,coverageCertified:false"));
});

const refreshModule={exports:{}};
new Function("require","exports",ts.transpileModule(read("lib/hoopdata-competition-refresh.ts"),cjsOptions).outputText)(name=>{
  if(name==="./hoopdata-api-sports-competition")return competitionModule.exports;
  if(name==="./hoopdata-competition-worker")return competitionWorkerModule.exports;
  throw Error(name);
},refreshModule.exports);
const {runCompetitionRefreshTick}=refreshModule.exports;
test("competition refresh runs one leased task with a uniquely confirmed season and finalizes the matching lease",async()=>{
  const mapping={leagueId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",providerLeagueId:12,side:"womens",reviewed:true,evidence:"verified"};
  const current={season:"2026-2027",start:"2026-10-01",end:"2027-06-01",games:true,standings:true};
  const job={leagueId:mapping.leagueId,kind:"games",leaseToken:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",mapping,seasonRows:[current]};
  const calls=[];
  const deps={now:()=>new Date("2026-11-25T13:00:00Z"),claim:async()=>job,execute:async(task,claim)=>{assert.equal(claim.leaseToken,job.leaseToken);calls.push(task);return {state:"staged"}},finish:async(claim,outcome)=>{assert.equal(claim.leaseToken,job.leaseToken);calls.push(outcome);return true}};
  assert.equal((await runCompetitionRefreshTick(deps)).state,"staged");
  assert.deepEqual(calls,[{kind:"games",mapping,season:"2026-2027"},{state:"staged",reason:"staged"}]);
  for(const seasonRows of [null,[],[current,current],[{...current,games:false}],[{...current,start:"2027-10-01",end:"2028-06-01"}]]){
    calls.length=0;
    assert.equal((await runCompetitionRefreshTick({...deps,claim:async()=>({...job,seasonRows})})).state,"deferred");
    assert.deepEqual(calls,[{state:"deferred",reason:"active-season-or-coverage-unconfirmed"}]);
  }
  calls.length=0;
  assert.equal((await runCompetitionRefreshTick({...deps,claim:async()=>null})).state,"idle");assert.deepEqual(calls,[]);
  assert.equal((await runCompetitionRefreshTick({...deps,finish:async()=>false})).state,"lease-lost");
  const retryAt="2026-11-25T14:00:00Z";
  calls.length=0;
  const r=await runCompetitionRefreshTick({...deps,execute:async()=>({state:"provider-error",retryAt})});
  assert.equal(r.state,"failed");assert.equal(r.retryAt,retryAt);
  assert.deepEqual(calls,[{state:"failed",reason:"provider-error",retryAt}]);
});
test("refresh tick route remains preview-only with isolated credentials and uses existing durable quota",()=>{
  const route=read("app/api/cron/hoopdata-competition-refresh-preview/route.ts");
  const gate=route.indexOf('process.env.VERCEL_ENV!=="preview"');
  const auth=route.indexOf('request.headers.get("authorization")');
  const db=route.indexOf("const db=createClient");
  assert.ok(gate>0&&gate<auth&&auth<db);
  assert.ok(route.indexOf("key===appKey||providerKey===appProvider")<db);
  assert.ok(route.includes('new URL(url).origin===new URL(appUrl).origin'));
  assert.ok(route.includes('db.rpc("hoopdata_claim_competition_refresh")'));
  assert.ok(route.includes('db.rpc("hoopdata_reserve_request"'));
  assert.ok(route.includes('db.rpc("hoopdata_finish_competition_refresh"'));
  assert.ok(route.includes('db.rpc("hoopdata_stage_leased_competition_snapshot",{p_token:claim.leaseToken'));
  assert.ok(route.includes("canonicalWrites:false,coverageCertified:false"));
});

const standingsReviewModule={exports:{}};
new Function("require","exports",ts.transpileModule(read("lib/hoopdata-standings-review.ts"),cjsOptions).outputText)(name=>{
  if(name==="./hoopdata-api-sports-competition")return competitionModule.exports;
  if(name==="./hoopdata-competition-worker")return competitionWorkerModule.exports;
  throw Error(name);
},standingsReviewModule.exports);
const {prepareStandingsForReview}=standingsReviewModule.exports;
function standingsReviewFixture(){
  const leagueId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",providerLeagueId=12,side="womens",season="2026-2027",observedAt="2026-11-25T13:00:00.000Z";
  const mapping={leagueId,providerLeagueId,side,reviewed:true,evidence:"verified league"};
  const row={teamId:1,stage:"Regular",group:"East",position:1,played:5,wins:3,losses:2,pointsFor:null,pointsAgainst:400};
  const rows=[row,{...row,teamId:2,position:2},{...row,stage:"Playoffs",group:null,played:null,wins:null,losses:null}];
  const snapshot={leagueId,providerLeagueId,season,observedAt,rows};
  const review={leagueId,providerLeagueId,season,observedAt,reviewed:true,evidence:"independently reviewed full roster",groups:[{stage:"Regular",group:"East",providerTeamIds:[1,2]},{stage:"Playoffs",group:null,providerTeamIds:[1]}]};
  const teamMappings=[{leagueId,providerLeagueId,side,providerTeamId:1,teamId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",reviewed:true},{leagueId,providerLeagueId,side,providerTeamId:2,teamId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",reviewed:true}];
  return {mapping,snapshot,review,teamMappings,now:new Date("2026-11-25T13:30:00Z"),maxAgeMs:3600000,providerStandingsSupported:true};
}
test("standings review preserves provider stage, group, rank and null statistics with reviewed team identities",()=>{
  const input=standingsReviewFixture();
  const result=prepareStandingsForReview(input);
  assert.equal(result.state,"eligible-for-review");
  assert.equal(result.rows.length,3);
  assert.equal(result.rows[0].canonicalTeamId,input.teamMappings[0].teamId);
  assert.equal(result.rows[0].pointsFor,null);
  assert.equal(result.rows[1].position,2);
  assert.equal(result.rows[2].stage,"Playoffs");
  assert.equal(result.rows[2].group,null);
  assert.equal(result.source,"api-sports-basketball");
});
test("standings review fails closed for incomplete groups, duplicate teams, wrong identity, changed snapshot or missing certification",()=>{
  const i=standingsReviewFixture(),rows=i.snapshot.rows;
  for(const changed of [[rows[0],rows[1]],[rows[0],rows[0],rows[2]],[rows[0],{...rows[1],group:"West"},rows[2]]]){
    assert.equal(prepareStandingsForReview({...i,snapshot:{...i.snapshot,rows:changed}}).state,"incomplete");
  }
  assert.equal(prepareStandingsForReview({...i,review:{...i.review,observedAt:"2026-11-25T12:00:00.000Z"}}).state,"review-required");
  assert.equal(prepareStandingsForReview({...i,review:{...i.review,season:"2025-2026"}}).state,"review-required");
  assert.equal(prepareStandingsForReview({...i,review:{...i.review,reviewed:false}}).state,"review-required");
  assert.equal(prepareStandingsForReview({...i,teamMappings:[i.teamMappings[0],{...i.teamMappings[1],side:"mens"}]}).state,"review-required");
  assert.equal(prepareStandingsForReview({...i,teamMappings:[i.teamMappings[0],{...i.teamMappings[1],teamId:i.teamMappings[0].teamId}]}).state,"review-required");
  assert.equal(prepareStandingsForReview({...i,providerStandingsSupported:null}).state,"review-required");
  assert.equal(prepareStandingsForReview({...i,providerStandingsSupported:false}).state,"unsupported");
});
test("standings review rejects stale or future observations and impossible statistics",()=>{
  const i=standingsReviewFixture();
  assert.equal(prepareStandingsForReview({...i,now:new Date("2026-11-25T14:00:01Z")}).state,"stale");
  assert.equal(prepareStandingsForReview({...i,now:new Date("2026-11-25T12:59:59Z")}).state,"invalid");
  assert.equal(prepareStandingsForReview({...i,maxAgeMs:0}).state,"invalid");
  assert.equal(prepareStandingsForReview({...i,snapshot:{...i.snapshot,rows:[{...i.snapshot.rows[0],wins:6},...i.snapshot.rows.slice(1)]}}).state,"invalid");
});

const projectionModule={exports:{}};
new Function("require","exports",ts.transpileModule(read("lib/hoopdata-standings-projection.ts"),cjsOptions).outputText)(name=>{
  if(name==="./hoopdata-standings-review")return standingsReviewModule.exports;
  throw Error(name);
},projectionModule.exports);
const {projectAttestedStandings}=projectionModule.exports;
function projectionFixture(){
  const i=standingsReviewFixture(),{leagueId,providerLeagueId,season,observedAt,rows}=i.snapshot;
  const mappingReviewedAt="2026-11-24T12:00:00.000Z";
  const attestation={leagueId,providerLeagueId,season,observedAt,mappingReviewedAt,reviewedAt:"2026-11-25T13:15:00.000Z",evidence:"private roster reference",reviewedBy:"private reviewer",
    snapshotRows:rows.map(r=>({...r})),reviewedRoster:rows.map(r=>({teamId:r.teamId,stage:r.stage,group:r.group})),
    reviewedTeamIds:Object.fromEntries(i.teamMappings.map(m=>[m.providerTeamId,m.teamId]))};
  return {...i,leagueActive:true,mappingReviewedAt,attestation};
}
test("attested standings projection allowlists public data and preserves provider rankings and unknown statistics",()=>{
  const i=projectionFixture(),r=projectAttestedStandings(i);
  assert.equal(r.state,"eligible-for-publication");
  assert.deepEqual(Object.keys(r).sort(),["state","source","leagueId","season","observedAt","rows"].sort());
  assert.deepEqual(r.rows[0],{teamId:i.teamMappings[0].teamId,stage:"Regular",group:"East",position:1,played:5,wins:3,losses:2,pointsFor:null,pointsAgainst:400});
  assert.equal(r.rows[2].stage,"Playoffs");
  assert.doesNotMatch(JSON.stringify(r),/private roster reference|private reviewer|providerLeagueId|canonicalTeamId|reviewedTeamIds/);
});
test("attested standings projection fails closed on replaced snapshot, modified rows, or changed mapping",()=>{
  const i=projectionFixture();
  for(const x of [
    {...i,snapshot:{...i.snapshot,observedAt:"2026-11-25T13:10:00.000Z"}},
    {...i,snapshot:{...i.snapshot,rows:i.snapshot.rows.map((r,n)=>n===0?{...r,position:4}:r)}},
    {...i,mappingReviewedAt:"2026-11-25T12:00:00.000Z"},
    {...i,teamMappings:i.teamMappings.map((m,n)=>n===0?{...m,teamId:"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}:m)},
    {...i,attestation:{...i.attestation,reviewedAt:"2026-11-25T14:00:00.000Z"}},
    {...i,attestation:{...i.attestation,reviewedTeamIds:{...i.attestation.reviewedTeamIds,3:"unreviewed"}}}
  ])assert.equal(projectAttestedStandings(x).state,"review-required");
});
test("attested standings projection refuses missing, stale or unsupported data without returning rows",()=>{
  const i=projectionFixture();
  for(const [x,state] of [
    [{...i,attestation:null},"unavailable"],
    [{...i,leagueActive:false},"unavailable"],
    [{...i,now:new Date("2026-11-25T14:01:00.000Z")},"stale"],
    [{...i,providerStandingsSupported:false},"unsupported"],
    [{...i,providerStandingsSupported:null},"review-required"],
    [{...i,attestation:{...i.attestation,reviewedRoster:i.attestation.reviewedRoster.slice(1)}},"review-required"]
  ])assert.deepEqual(projectAttestedStandings(x),{state});
});

test("score display preview is authenticated, isolated and source-labelled",async()=>{
  const src=read("app/api/cron/hoopdata-score-display-preview/route.ts");
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  let calls=0;
  let row={game_id:id,status:"live",home_score:91,away_score:98,score_updated_at:new Date(Date.now()-1000).toISOString(),score_source:"balldontlie-nba",private_evidence:"never expose"};
  new Function("require","exports",js)(name=>{
    if(name==="next/server")return {NextResponse:{json:(body,init)=>Response.json(body,init)}};
    if(name==="@supabase/supabase-js")return {createClient:(url,key)=>{
      assert.equal(url,"https://isolated.invalid");assert.equal(key,"test-isolated");
      return {rpc:(fn,args)=>{calls++;assert.equal(fn,"hoopdata_read_score_display");assert.deepEqual(args,{p_game:id});return {abortSignal:async()=>({data:[row],error:null})};}};
    }};
    throw Error(name);
  },mod.exports);
  const env={VERCEL_ENV:"production",HOOPDATA_SCORE_DISPLAY_PREVIEW_ENABLED:"true",HOOPDATA_PREVIEW_CRON_SECRET:"test-secret",HOOPDATA_ISOLATED_SUPABASE_URL:"https://app.invalid",HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY:"test-isolated",NEXT_PUBLIC_SUPABASE_URL:"https://app.invalid",SUPABASE_SERVICE_ROLE_KEY:"test-app"};
  const before=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
  const req=(auth=true)=>new Request("https://fixture.invalid/api/cron/hoopdata-score-display-preview?gameId="+id,{headers:auth?{Authorization:"Bearer test-secret"}:{}});
  try{
    Object.assign(process.env,env);
    assert.equal((await mod.exports.GET(req())).status,404);
    process.env.VERCEL_ENV="preview";
    assert.equal((await mod.exports.GET(req(false))).status,401);
    assert.equal((await mod.exports.GET(req())).status,503);
    assert.equal(calls,0);
    process.env.HOOPDATA_ISOLATED_SUPABASE_URL="https://isolated.invalid";
    const result=await mod.exports.GET(req());
    assert.equal(result.status,200);assert.equal(result.headers.get("cache-control"),"private, no-store");
    assert.deepEqual(await result.json(),{game:{id,status:"live",home_score:91,away_score:98,score_updated_at:row.score_updated_at,score_source:"balldontlie-nba"},preview:true});
    row={...row,status:"final"};
    assert.equal((await mod.exports.GET(req())).status,503);
    row={...row,status:"live",score_updated_at:new Date(Date.now()-360000).toISOString()};
    assert.equal((await mod.exports.GET(req())).status,503);
    row={...row,score_source:"primary",status:"final",home_score:80};
    assert.equal((await mod.exports.GET(req())).status,200);
  }finally{for(const [k,v] of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

test("provider expansion requires explicit scoped rights and rejects ambiguous, expired and revoked records",async()=>{
 const js=ts.transpileModule(read("lib/hoopdata-provider-rights.ts"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const {evaluateProviderRights:evaluate}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
 const now=new Date("2026-11-25T12:00:00Z");
 const req={provider:"highlightly",competitionId:"reviewed-league",kind:"scores",use:"app-display",plan:"free"};
 const grant={...req,evidenceRef:"private-review-1",reviewerId:"operator",reviewedAt:"2026-11-24T12:00:00Z",validUntil:"2026-12-01T12:00:00Z",uses:["app-display","cache"],status:"approved",retentionHours:24,attribution:"Example source",upstreamRightsConfirmed:true,artworkPermissionConfirmed:false,appStorePermissionConfirmed:true};
 assert.equal(evaluate(req,[grant],now).allowed,true);
 for(const grants of [[],[grant,grant],[{...grant,status:"revoked"}],[{...grant,validUntil:now.toISOString()}],[{...grant,upstreamRightsConfirmed:false}],[{...grant,appStorePermissionConfirmed:false}],[{...grant,evidenceRef:""}]])assert.equal(evaluate(req,grants,now).allowed,false);
 for(const changed of [{provider:"fiba-gdap"},{competitionId:"other"},{plan:"paid"},{use:"notifications"},{kind:"artwork"}])assert.equal(evaluate({...req,...changed},[grant],now).allowed,false);
 assert.equal(evaluate({...req,kind:"artwork"},[{...grant,kind:"artwork"}],now).allowed,false);
 assert.equal(evaluate({...req,use:"cache",retentionHours:24},[grant],now).allowed,true);
 for(const hours of [undefined,0,25,Infinity,NaN])assert.equal(evaluate({...req,use:"cache",retentionHours:hours},[grant],now).allowed,false);
 assert.equal(evaluate({...req,use:"cache",retentionHours:24},[{...grant,validUntil:"2026-11-25T13:00:00Z"}],now).allowed,false);
});
