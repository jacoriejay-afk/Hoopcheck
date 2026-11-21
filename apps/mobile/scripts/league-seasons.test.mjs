import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { readLeagueClubs } from '../src/native/leagueSeasons.ts';
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const client=request=>createClient('https://fixture.supabase.co','fixture',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:request}});
test('exact historical season excludes current links and includes inactive historical memberships',async()=>{
 let requests=0;const db=client(async input=>{requests++;const u=new URL(String(input));if(u.pathname.endsWith('/team_league_memberships')){assert.equal(u.searchParams.get('season'),'eq.2025–26');assert.equal(u.searchParams.has('active'),false);return Response.json([{team_id:id(2)}]);}assert.equal(u.searchParams.has('league_id'),false);assert.equal(u.searchParams.get('active'),'eq.true');return Response.json([{id:id(2),name:'Historical club',country:'Spain'}]);});
 const result=await readLeagueClubs(db,id(1),{season:' 2025–26 '});assert.equal(result.season,'2025–26');assert.equal(result.clubs[0].name,'Historical club');assert.equal(requests,2);
});
test('current mode unions active memberships and direct links without duplicate clubs',async()=>{
 const db=client(async input=>{const u=new URL(String(input));if(u.pathname.endsWith('/team_league_memberships')){assert.equal(u.searchParams.get('active'),'eq.true');assert.equal(u.searchParams.has('season'),false);return Response.json([{team_id:id(2)}]);}return Response.json([{id:id(2),name:'Current club',country:null}]);});assert.equal((await readLeagueClubs(db,id(1))).clubs.length,1);
});
test('bad season and aborted requests make no reads; server failures are not empty seasons',async()=>{
 let reads=0;const db=client(async()=>{reads++;return Response.json({message:'unavailable'},{status:503});});await assert.rejects(readLeagueClubs(db,id(1),{season:'x'.repeat(81)}));const controller=new AbortController();controller.abort();await assert.rejects(readLeagueClubs(db,id(1),{signal:controller.signal}));assert.equal(reads,0);await assert.rejects(readLeagueClubs(db,id(1),{season:'2025–26'}),/could not load/);
});
