import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { readLeagueClubs, readRecordedLeagueSeasons } from '../src/native/leagueSeasons.ts';
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const client=request=>createClient('https://fixture.supabase.co','fixture',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:request}});
test('exact historical season excludes current links and includes inactive historical memberships',async()=>{
 let requests=0;const db=client(async input=>{requests++;const u=new URL(String(input));if(u.pathname.endsWith('/team_league_memberships')){assert.equal(u.searchParams.get('season'),'eq.2025–26');assert.equal(u.searchParams.has('active'),false);return Response.json([{team_id:id(2)}]);}assert.equal(u.searchParams.has('league_id'),false);assert.equal(u.searchParams.get('active'),'eq.true');return Response.json([{id:id(2),name:'Historical club',country:'Spain'}]);});
 const result=await readLeagueClubs(db,id(1),{season:' 2025–26 '});assert.equal(result.season,'2025–26');assert.equal(result.clubs[0].name,'Historical club');assert.equal(requests,2);
});
test('current mode unions active memberships and direct links without duplicate clubs',async()=>{
 const db=client(async input=>{const u=new URL(String(input));if(u.pathname.endsWith('/leagues'))return Response.json({season:'2026-27'});if(u.pathname.endsWith('/team_league_memberships')){assert.equal(u.searchParams.get('active'),'eq.true');assert.equal(u.searchParams.get('season'),'eq.2026-27');return Response.json([{team_id:id(2)}]);}return Response.json([{id:id(2),name:'Current club',country:null}]);});assert.equal((await readLeagueClubs(db,id(1))).clubs.length,1);
});
test('bad season and aborted requests make no reads; server failures are not empty seasons',async()=>{
 let reads=0;const db=client(async()=>{reads++;return Response.json({message:'unavailable'},{status:503});});await assert.rejects(readLeagueClubs(db,id(1),{season:'x'.repeat(81)}));const controller=new AbortController();controller.abort();await assert.rejects(readLeagueClubs(db,id(1),{signal:controller.signal}));assert.equal(reads,0);await assert.rejects(readLeagueClubs(db,id(1),{season:'2025–26'}),/could not load/);
});

test('recorded season discovery keeps exact labels, deduplicates, and does not filter active links',async()=>{
 const db=client(async input=>{const u=new URL(String(input));assert.equal(u.searchParams.get('league_id'),'eq.'+id(1));assert.equal(u.searchParams.has('active'),false);assert.equal(u.searchParams.get('limit'),'201');return Response.json([{season:'2026–27'},{season:'2025-26'},{season:'2025-26'},{season:null},{season:' bad '}]);});
 assert.deepEqual(await readRecordedLeagueSeasons(db,id(1)),{seasons:['2026–27','2025-26'],limited:false});
});
test('season sample reports truncation and fails closed on read failure',async()=>{
 const db=client(async()=>Response.json(Array.from({length:201},()=>({season:'2025-26'}))));
 assert.deepEqual(await readRecordedLeagueSeasons(db,id(1)),{seasons:['2025-26'],limited:true});
 const broken=client(async()=>Response.json({message:'unavailable'},{status:503}));
 await assert.rejects(readRecordedLeagueSeasons(broken,id(1)),/could not load/);
 const aborted=new AbortController();aborted.abort();await assert.rejects(readRecordedLeagueSeasons(db,id(1),aborted.signal));
});

test('large league paginates all club IDs and preserves foreign origin',async()=>{
 const teams=Array.from({length:205},(_,i)=>({id:id(i+2),name:'Club '+String(i+1).padStart(3,'0'),country:i===204?'Kazakhstan':'Armenia'}));
 let membershipPages=0,directPages=0;
 const db=client(async input=>{
   const u=new URL(String(input)),offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||100);
   if(u.pathname.endsWith('/leagues'))return Response.json({season:'2026-27'});
   if(u.pathname.endsWith('/team_league_memberships')){
     membershipPages++;assert.equal(u.searchParams.get('season'),'eq.2026-27');
     return Response.json(teams.slice(offset,offset+limit).map(t=>({team_id:t.id})));
   }
   if(u.searchParams.has('league_id')){directPages++;return Response.json(teams.slice(0,150).slice(offset,offset+limit));}
   const filter=u.searchParams.get('id');
   assert.ok(filter);
   return Response.json(teams.filter(t=>filter.includes(t.id)).slice(offset,offset+limit));
 });
 const result=await readLeagueClubs(db,id(1));
 assert.equal(result.clubs.length,205);assert.equal(result.limited,false);
 assert.equal(result.clubs.find(t=>t.id===id(206)).country,'Kazakhstan');
 assert.equal(membershipPages,3);assert.equal(directPages,2);
});
test('missing stored season retains legacy active membership fallback',async()=>{
 const db=client(async input=>{const u=new URL(String(input));if(u.pathname.endsWith('/leagues'))return Response.json({season:null});if(u.pathname.endsWith('/team_league_memberships')){assert.equal(u.searchParams.get('active'),'eq.true');assert.equal(u.searchParams.has('season'),false);return Response.json([]);}return Response.json([{id:id(2),name:'Legacy club',country:'Georgia'}]);});
 assert.equal((await readLeagueClubs(db,id(1))).clubs[0].country,'Georgia');
});
