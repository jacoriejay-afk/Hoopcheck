import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
function moduleUrl(path,replacements={}) {
 let src=readFileSync(new URL("../"+path,import.meta.url),"utf8");
 for(const [from,to] of Object.entries(replacements)) src=src.replace(from,to);
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return "data:text/javascript;base64,"+Buffer.from(js).toString("base64");
}
const inputUrl=moduleUrl("lib/career/claim-input.ts");
const searchUrl=moduleUrl("lib/career/historical-club-search.ts",{"./claim-input":inputUrl});
const {historicalClubSearch,historicalClubFields,historicalClubResultLimit}=await import(searchUrl);
test("exact historical season, Unicode name, explicit category",()=>{
 const p=new URLSearchParams({q:" Žalgiris ",season:"2023-24",basketballType:"mens"});
 assert.deepEqual(historicalClubSearch(p,2026),{name:"Žalgiris",season:{startYear:2023,endYear:2024,label:"2023-2024"},basketballType:"mens"});
 for(const q of ["a","%","a_b","a*b","a\\b","x".repeat(101)]) assert.equal(historicalClubSearch(new URLSearchParams({...Object.fromEntries(p),q}),2026),null,q);
 for(const season of ["2027","2022-25",""]) assert.equal(historicalClubSearch(new URLSearchParams({...Object.fromEntries(p),season}),2026),null,season);
 assert.equal(historicalClubSearch(new URLSearchParams({...Object.fromEntries(p),basketballType:"all"}),2026),null);
 assert.equal(historicalClubResultLimit,30);
 assert.doesNotMatch(historicalClubFields,/player_id|evidence|verified_by|source_reference/);
});
test("route is gated, caller-authenticated, bounded and fails closed",async()=>{
 const calls=[];
 const fixture={role:"player",authError:false,dbError:false};
 const responseMock="data:text/javascript,"+encodeURIComponent("export const NextResponse={json:(body,options)=>({body,...options})};");
 const dbMock="data:text/javascript,"+encodeURIComponent("export const createClient=(...args)=>globalThis.__careerSearchFixture(...args);");
 globalThis.__careerSearchFixture=(...args)=>{
   calls.push(["client",...args]);
   return {auth:{getUser:async()=>({data:{user:fixture.authError?null:{id:"player-a"}},error:fixture.authError?{}:null})},from(table){
     calls.push(["from",table]);
     const chain={};
     for(const method of ["select","eq","not","ilike","order"]) chain[method]=(...a)=>{calls.push([method,...a]);return chain;};
     chain.maybeSingle=async()=>({data:{account_type:fixture.role},error:null});
     chain.limit=async(n)=>{calls.push(["limit",n]);return {data:Array.from({length:31},(_,i)=>({id:i})),error:fixture.dbError?{}:null};};
     return chain;
   }};
 };
 const {GET}=await import(moduleUrl("app/api/career/historical-clubs/route.ts",{"next/server":responseMock,"@supabase/supabase-js":dbMock,"../../../../lib/career/historical-club-search":searchUrl}));
 const vars=["HOOPCHECK_CAREER_CLAIMS_ENABLED","NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
 const old=Object.fromEntries(vars.map(k=>[k,process.env[k]]));
 const request=(token=true)=>new Request("https://example.invalid/api/career/historical-clubs?q=Old+Club&season=2023-24&basketballType=womens",{headers:token?{authorization:"Bearer fixture-token"}:{}});
 try {
   delete process.env.HOOPCHECK_CAREER_CLAIMS_ENABLED;
   assert.equal((await GET(request())).status,503);
   assert.equal(calls.length,0);
   process.env.HOOPCHECK_CAREER_CLAIMS_ENABLED="true";
   process.env.NEXT_PUBLIC_SUPABASE_URL="https://fixture.invalid";
   process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="fixture-key";
   assert.equal((await GET(request(false))).status,401);
   fixture.authError=true;assert.equal((await GET(request())).status,401);fixture.authError=false;
   fixture.role="fan";assert.equal((await GET(request())).status,403);fixture.role="player";
   const result=await GET(request());
   assert.equal(result.status,200);assert.equal(result.body.results.length,30);assert.equal(result.body.hasMore,true);
   assert.equal(result.headers["Cache-Control"],"no-store");
   for(const expected of [["from","historical_club_seasons"],["eq","season_start_year",2023],["eq","season_end_year",2024],["not","womens_team_id","is",null],["ilike","historical_name","%Old Club%"],["limit",31]]) assert.ok(calls.some(c=>JSON.stringify(c)===JSON.stringify(expected)),JSON.stringify(expected));
   fixture.dbError=true;assert.equal((await GET(request())).status,503);
 } finally {
   for(const k of vars) if(old[k]===undefined) delete process.env[k]; else process.env[k]=old[k];
   delete globalThis.__careerSearchFixture;
 }
});
