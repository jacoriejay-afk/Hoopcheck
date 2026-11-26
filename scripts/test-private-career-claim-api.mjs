import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
function url(path,replacements={}){
 let source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
 for(const [a,b] of Object.entries(replacements)) source=source.replace(a,b);
 return "data:text/javascript;base64,"+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString("base64");
}
const inputUrl=url("lib/career/private-claim-input.ts",{"./claim-input":url("lib/career/claim-input.ts")});
const {parsePrivateCareerClaim}=await import(inputUrl);
const valid={kind:"claim",id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",source:"womens_teams",season:"2023-24"};
const missing={kind:"missing_club",name:"Former BC",country:"Portugal",league:"First division",division:"1",basketballType:"mens",season:"2022-23"};
test("claim input rejects forged identity/status and canonicalizes season",()=>{
 assert.deepEqual(parsePrivateCareerClaim(valid,2026),{kind:"claim",row:{team_id:null,womens_team_id:valid.id,season_start_year:2023,season_end_year:2024}});
 for(const extra of [{player_id:"other"},{verification_status:"verified"},{status:"approved"},{evidence_reference:"anything"},{source:"other"},{season:"2027"}])assert.equal(parsePrivateCareerClaim({...valid,...extra},2026),null);
 assert.equal(parsePrivateCareerClaim(missing,2026).row.historical_name,"Former BC");
 for(const extra of [{name:" "},{country:""},{city:[]},{division:"x".repeat(101)},{resolved_snapshot_id:"fake"},{status:"resolved"}])assert.equal(parsePrivateCareerClaim({...missing,...extra},2026),null);
});
test("route enforces caller identity and pending-only writes",async()=>{
 const calls=[];const fixture={role:"player",authError:false,error:null,claims:[],snapshots:[]};
 globalThis.__careerClaimsMock=()=>({auth:{getUser:async()=>({data:{user:fixture.authError?null:{id:"own-player"}},error:fixture.authError?{}:null})},from(table){
  const c={select(...a){calls.push(["select",table,...a]);return c;},eq(...a){calls.push(["eq",table,...a]);return c;},order(){return c;},in(...a){calls.push(["in",table,...a]);return c;},limit:async()=>({data:table==="player_team_season_claims"?fixture.claims:table==="historical_club_seasons"?fixture.snapshots:[],error:fixture.error}),maybeSingle:async()=>({data:{account_type:fixture.role},error:null}),insert(row){calls.push(["insert",table,row]);return c;},single:async()=>({data:fixture.error?null:{id:"new-id"},error:fixture.error})};return c;
 }});
 const response="data:text/javascript,"+encodeURIComponent("export const NextResponse={json:(body,opts)=>({body,...opts})};");
 const db="data:text/javascript,"+encodeURIComponent("export const createClient=()=>globalThis.__careerClaimsMock();");
 const {GET,POST}=await import(url("app/api/career/claims/route.ts",{"next/server":response,"@supabase/supabase-js":db,"../../../../lib/career/private-claim-input":inputUrl}));
 const vars=["HOOPCHECK_CAREER_CLAIMS_ENABLED","NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];const old=Object.fromEntries(vars.map(k=>[k,process.env[k]]));
 const request=(body,token=true)=>new Request("https://fixture.invalid/api/career/claims",{method:body===undefined?"GET":"POST",headers:{"content-type":"application/json",...(token?{authorization:"Bearer fixture"}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 try{
  delete process.env.HOOPCHECK_CAREER_CLAIMS_ENABLED;assert.equal((await POST(request(valid))).status,503);assert.equal(calls.length,0);
  process.env.HOOPCHECK_CAREER_CLAIMS_ENABLED="true";process.env.NEXT_PUBLIC_SUPABASE_URL="https://fixture.invalid";process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="fixture";
  assert.equal((await POST(request(valid,false))).status,401);
  fixture.authError=true;assert.equal((await POST(request(valid))).status,401);fixture.authError=false;
  fixture.role="fan";assert.equal((await POST(request(valid))).status,403);fixture.role="player";
  assert.equal((await POST(request({...valid,player_id:"other"}))).status,400);
  assert.equal((await POST(request(valid))).status,201);
  assert.equal((await POST(request(missing))).status,201);
  const writes=calls.filter(x=>x[0]==="insert");assert.equal(writes.length,2);
  for(const w of writes){assert.equal(w[2].player_id,"own-player");assert.ok(!("status" in w[2]));assert.ok(!("verification_status" in w[2]));}
  assert.equal(writes[0][1],"player_team_season_claims");assert.equal(writes[1][1],"historical_club_requests");
  fixture.error={code:"23505"};assert.equal((await POST(request(valid))).status,409);fixture.error=null;
  assert.equal((await GET(request())).status,200);
  fixture.claims=[{id:"a",team_id:null,womens_team_id:valid.id,season_start_year:2023,season_end_year:2024,verification_status:"pending"},{id:"b",team_id:null,womens_team_id:valid.id,season_start_year:2022,season_end_year:2023,verification_status:"verified"}];
  fixture.snapshots=[{team_id:null,womens_team_id:valid.id,season_start_year:2023,season_end_year:2024,historical_name:"Former club",historical_league:"Old league",historical_division:"2",historical_country:"Portugal",private_note:"never return"}];
  const history=await GET(request());
  assert.equal(history.status,200);
  assert.deepEqual(history.body.claims[0].historicalClub,{name:"Former club",league:"Old league",division:"2",country:"Portugal"});
  assert.equal(history.body.claims[0].verification_status,"pending");
  assert.equal(history.body.claims[1].historicalClub,null);
  assert.ok(calls.some(x=>x[0]==="in"&&x[1]==="historical_club_seasons"&&x[2]==="womens_team_id"));

  for(const table of ["player_team_season_claims","historical_club_requests"])assert.ok(calls.some(x=>x[0]==="eq"&&x[1]===table&&x[2]==="player_id"&&x[3]==="own-player"));
 }finally{for(const k of vars)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];delete globalThis.__careerClaimsMock;}
});

test("web private career intake clears and hides drafts on identity change",()=>{
 const source=readFileSync(new URL("../components/CareerClaimIntake.tsx",import.meta.url),"utf8");
 assert.match(source,/session\?\.user\.id!==userId\)\{active\.current=false;sessionVersion\.current\+\+;setSessionInvalidated\(true\)/);
 assert.match(source,/after\?\.user\.id!==userId/);
 assert.match(source,/setName\(""\);setSeason\(""\);setCountry\(""\)/);
 assert.match(source,/if\(sessionInvalidated\)return <p/);
 assert.match(source,/if\(!active\.current\)return;lock\.current=true/);
});
