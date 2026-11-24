import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { readTeamRoster } from '../src/native/teamRoster.ts';
import { summarizeCareer } from '../src/native/careerSummary.ts';
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
function client(request) { return createClient('https://fixture.supabase.co','fixture',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:request}}); }
test('roster refuses fans and malformed identities before any database request',async()=>{
 let calls=0;const db=client(async()=>{calls++;return Response.json([]);});
 for(const viewer of [{id:id(1),accountType:'fan'},{id:'invalid',accountType:'player'}]) await assert.rejects(readTeamRoster(db,id(2),viewer));
 assert.equal(calls,0);
});
test('roster uses opt-in history and canonical player projections; private players and expired spots stay absent',async()=>{
 const calls=[];
 const db=client(async(input,options)=>{
  const url=new URL(String(input));calls.push(url.pathname);
  if(url.pathname.endsWith('/player_career_stops')){
   assert.equal(url.searchParams.get('team_id'),'eq.'+id(2));assert.equal(url.searchParams.get('is_public'),'eq.true');
   assert.equal(url.searchParams.get('limit'),'24');
   return Response.json([{player_id:id(3),team_name:'Club',seasons:'2025–26'},{player_id:id(4),team_name:'Club',seasons:'PRIVATE'}]);
  }
  if(url.pathname.endsWith('/team_roster_spots')){
   assert.equal(url.searchParams.get('status'),'eq.open');assert.equal(url.searchParams.get('team_id'),'eq.'+id(2));
   return Response.json([{id:id(5),title:'Guard opening',description:'Contact the club',season:'2026',expires_at:null},{id:id(6),title:'EXPIRED',expires_at:'2000-01-01T00:00:00Z'}]);
  }
  const body=JSON.parse(options.body);
  if(url.pathname.endsWith('/get_public_player_profile'))return Response.json(body.p_user_id===id(3)?[{id:id(3),display_name:'Visible player',player_position:'PG',player_verified:true,current_country:'DO NOT COPY'}]:[]);
  if(url.pathname.endsWith('/is_player_country_public'))return Response.json(false);
  throw Error('Forbidden data path '+url.pathname);
 });
 const result=await readTeamRoster(db,id(2),{id:id(1),accountType:'player'});
 assert.equal(result.players.length,1);assert.equal(result.players[0].name,'Visible player');assert.deepEqual(result.players[0].seasons,['2025–26']);
 assert.deepEqual(result.spots.map(row=>row.title),['Guard opening']);assert.ok(!JSON.stringify(result).includes('DO NOT COPY'));assert.ok(!JSON.stringify(result).includes('PRIVATE'));
 assert.ok(!calls.some(path=>path==='/rest/v1/profiles'));
});
test('career summaries count distinct returned records without inferring seasons or performance averages',()=>{
 const row={id:'1',team_name:' Club ',country:'Spain',seasons:'2025–26'};
 assert.deepEqual(summarizeCareer([row,row,{id:'2',team_name:'club',country:'SPAIN',seasons:'2026–27'}]),{stops:2,teams:1,countries:1});
 assert.deepEqual(summarizeCareer([]),{stops:0,teams:0,countries:0});
});
