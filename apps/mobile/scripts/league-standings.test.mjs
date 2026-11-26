import assert from "node:assert/strict";
import {test} from "node:test";
import {parseNativeStandings,isStandingsCurrent,readNativeStandings,validStandingsSeason} from "../src/native/leagueStandings.ts";
const leagueId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",teamId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",season="2026-2027",now=Date.parse("2026-11-25T13:30:00Z");
const view={leagueId,season,side:"womens",source:"API-Sports",attribution:"Licensed source",observedAt:"2026-11-25T13:00:00Z",expiresAt:"2026-11-25T14:00:00Z",groups:[{stage:"Regular",group:null,rows:[{teamId,name:"Verified club",position:1,played:0,wins:null,losses:0,pointsFor:null,pointsAgainst:0}]}]};
const parse=(v=view)=>parseNativeStandings({state:"available",view:v},leagueId,season,"womens",now);
test("native standings preserve real zero, official rank and missing data separately",()=>{
 const data=parse();assert.equal(data.groups[0].rows[0].played,0);assert.equal(data.groups[0].rows[0].wins,null);assert.equal(data.groups[0].rows[0].position,1);
 assert.equal(isStandingsCurrent(data,now),true);assert.equal(isStandingsCurrent(data,Date.parse(data.expiresAt)),false);
});
test("native standings fail closed for wrong identity, expiry, duplicate group and invalid stats",()=>{
 for(const v of [{...view,side:"mens"},{...view,season:"2025-2026"},{...view,expiresAt:"2026-11-25T14:00:01Z"},{...view,expiresAt:"2026-11-25T13:29:00Z"},{...view,observedAt:"2026-11-25T13:31:00Z"},{...view,groups:[...view.groups,...view.groups]},{...view,groups:[{...view.groups[0],rows:[...view.groups[0].rows,...view.groups[0].rows]}]},{...view,groups:[{...view.groups[0],rows:[{...view.groups[0].rows[0],wins:-1}]}]}])assert.equal(parse(v),null);
 assert.equal(validStandingsSeason("2026-2027"),true);assert.equal(validStandingsSeason("2026-2029"),false);
});
test("native standings use only explicit HTTPS preview origin and never attach credentials",async()=>{
 const ctl=new AbortController();let calls=0;
 const request=async(url,opts)=>{calls++;assert.match(url,/^https:\/\/preview\.invalid\/api\/hoopdata\/standings-preview\?/);assert.equal(new URL(url).searchParams.get("side"),"womens");assert.equal(opts.redirect,"error");assert.equal(opts.signal,ctl.signal);assert.deepEqual(opts.headers,{Accept:"application/json"});return Response.json({state:"unavailable"});};
 for(const origin of ["https://hoopcheck.online","https://www.hoopcheck.online","http://preview.invalid","https://preview.invalid/path","https://a:b@preview.invalid"])await assert.rejects(()=>readNativeStandings(origin,leagueId,season,"womens",ctl.signal,request));
 assert.equal(calls,0);assert.equal(await readNativeStandings("https://preview.invalid",leagueId,season,"womens",ctl.signal,request),null);assert.equal(calls,1);
});
