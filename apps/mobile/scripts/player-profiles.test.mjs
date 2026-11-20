import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { canBrowsePlayers, readPlayerProfile, safeAvatar } from '../src/native/playerProfiles.ts';
import { readPlayerDirectory } from '../src/native/playerDirectory.ts';
const owner='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222';
const viewer={id:owner,accountType:'player'};
const profile={id:target,display_name:'Player',avatar_url:'https://fixture.test/approved.jpg',country:'Public country',current_country:'Hidden country',player_position:'PG',years_pro:3,current_team:'Club',player_verified:true};
function client(request){const source=createClient('https://fixture.supabase.co','fixture',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:request}});source.auth.getSession=async()=>({data:{session:{user:{id:owner},access_token:'fixture-owner-token'}},error:null});return source;}

test('fans and unknown roles fail closed before any profile or directory read',async()=>{
 let reads=0;const source=client(async()=>{reads++;return Response.json([]);});
 for(const role of ['fan','',undefined,'owner-from-metadata']){
  assert.equal(canBrowsePlayers(role),false);
  await assert.rejects(readPlayerProfile(source,{id:owner,accountType:role},target));
 }
 assert.equal(reads,0);assert.equal(canBrowsePlayers('player'),true);assert.equal(canBrowsePlayers('coach'),true);
});
test('canonical profile RPC and country opt-in mask private current location',async()=>{
 for(const publicCountry of [false,true]){
  const requests=[];const result=await readPlayerProfile(client(async(input,options)=>{
   const url=new URL(String(input));requests.push(url.pathname);assert.deepEqual(JSON.parse(options.body),{p_user_id:target});
   return Response.json(url.pathname.endsWith('/get_public_player_profile')?[profile]:publicCountry);
  }),viewer,target);
  assert.equal(result.current_country,publicCountry?'Hidden country':null);assert.equal(result.country,'Public country');assert.equal(result.position,'PG');assert.equal(result.player_verified,true);
  assert.deepEqual(requests,['/rest/v1/rpc/get_public_player_profile','/rest/v1/rpc/is_player_country_public']);
 }
});
test('missing canonical profile never falls back to another user raw row',async()=>{
 const requests=[];const result=await readPlayerProfile(client(async input=>{requests.push(new URL(String(input)).pathname);return Response.json([]);}),viewer,target);assert.equal(result,null);assert.deepEqual(requests,['/rest/v1/rpc/get_public_player_profile']);
});
test('country consent errors and non-boolean responses fail closed without raw profile fallback',async()=>{
 for(const proof of ['true',null,{error:'unavailable'}]){
  const requests=[];
  const result=await readPlayerProfile(client(async input=>{
   const path=new URL(String(input)).pathname;requests.push(path);
   if(path.endsWith('/get_public_player_profile'))return Response.json([profile]);
   return Response.json(proof,proof?.error?{status:503}:undefined);
  }),viewer,target);
  assert.equal(result.current_country,null);
  assert.deepEqual(requests,['/rest/v1/rpc/get_public_player_profile','/rest/v1/rpc/is_player_country_public']);
 }
});
test('owners can view their own private profile but cannot reveal an unapproved avatar',async()=>{
 const requests=[];const result=await readPlayerProfile(client(async input=>{
  const url=new URL(String(input));requests.push(url.pathname);
  if(url.pathname.endsWith('/get_public_player_profile'))return Response.json([]);
  assert.equal(url.pathname,'/rest/v1/rpc/get_own_profile');assert.equal(url.search,'');
  return Response.json({...profile,id:owner,account_type:'player',position:'SG',avatar_moderation_status:'rejected'});
 }),viewer,owner);assert.equal(result.current_country,'Hidden country');assert.equal(result.avatar_url,null);assert.equal(result.position,'SG');assert.equal(requests.length,2);
});
test('directory calls only shared RPC with literal username and bounded pagination',async()=>{
 const calls=[];const source=client(async(input,options)=>{calls.push({url:new URL(String(input)),body:JSON.parse(options.body)});return Response.json([]);});
 await readPlayerDirectory(source,'@player_one',30,30);assert.equal(calls[0].url.pathname,'/rest/v1/rpc/search_public_players_by_username');assert.deepEqual(calls[0].body,{p_username:'player_one',p_country:null,p_limit:31,p_offset:30});
 for(const input of ['', 'a', '(),.%'])await readPlayerDirectory(source,input);
 await readPlayerDirectory(source,'player',-1);assert.equal(calls.length,1);
});
test('avatar display rejects non-HTTPS or credential URLs',()=>{
 for(const value of [null,'javascript:alert(1)','http://example.test/photo','https://user:password@example.test/photo'])assert.equal(safeAvatar(value),null);
 assert.equal(safeAvatar('https://example.test/photo'),'https://example.test/photo');
});

test('directory rejects malformed RPC results and normalizes unsupported display fields',async()=>{
 const broken=await readPlayerDirectory(client(async()=>Response.json({id:target})),'player');assert.equal(broken.data,null);assert.ok(broken.error);
 const result=await readPlayerDirectory(client(async()=>Response.json([{id:target,display_name:{unexpected:true},country:false,years_pro:-1}])),'player');assert.equal(result.error,null);assert.equal(result.data[0].display_name,null);assert.equal(result.data[0].country,null);assert.equal(result.data[0].years_pro,null);
});
