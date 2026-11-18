import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { readLiveGames, readGameRoom, sendGameMessage, setGameChatControl, reportGameMessage, readPrediction, pickGameWinner } from '../src/native/liveGames.ts';
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const now=new Date('2026-11-18T12:00:00Z');
const game=(n,overrides={})=>({id:id(n),team_id:id(10),opponent_team_id:id(11),opponent_name:'Away',status:'scheduled',scheduled_at:'2026-11-18T12:30:00Z',...overrides});
const client=request=>createClient('https://fixture.supabase.co','key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:request}});
test('game discovery preserves side identity including away women and excludes stale scheduled fixtures',async()=>{
  const calls=[];
  const db=client(async input=>{const url=new URL(String(input));calls.push(url);return Response.json(url.pathname.endsWith('/fan_live_games')?[game(1),game(2,{scheduled_at:'2026-11-18T07:00:00Z'}),game(3,{team_id:id(12),opponent_team_id:id(13)})]:url.pathname.endsWith('/womens_teams')?[{id:id(11),name:'Away Women'}]:[]);});
  const data=await readLiveGames(db,'womens',null,now);
  assert.deepEqual(data.games.map(x=>x.id),[id(1)]);assert.equal(data.teams[id(11)].name,'Away Women');
  assert.equal(calls[0].searchParams.get('gte'),null);
  assert.equal(calls[0].searchParams.get('scheduled_at'),'gte.2026-11-11T12:00:00.000Z');
  assert.equal(calls[0].searchParams.get('limit'),'500');assert.equal(calls[0].searchParams.get('order'),'scheduled_at.asc.nullslast,id.asc');
  assert.equal(calls.find(url=>url.pathname.endsWith('/teams')).searchParams.get('basketball_type'),'eq.womens');
  assert.ok(!/email|salary/.test(calls[0].searchParams.get('select')));
});
test('free player listing uses existing bearer prediction API and never bypasses game-table RLS',async()=>{
  const calls=[];
  const db=client(async input=>{const url=new URL(String(input));calls.push(url.pathname);return Response.json([{id:id(10),name:'Home'}]);});
  let call;
  const result=await readLiveGames(db,'mens',{origin:'https://api.test',token:'fixture'},now,async(...args)=>{call=args;return Response.json({games:[game(1)]});});
  assert.equal(result.games.length,1);assert.ok(!calls.includes('/rest/v1/fan_live_games'));
  assert.equal(call[0],'https://api.test/api/game-predictions?mode=games');assert.equal(call[1].headers.Authorization,'Bearer fixture');assert.equal(call[1].cache,'no-store');assert.equal(call[1].redirect,'error');
  await assert.rejects(readLiveGames(db,'mens',{origin:'https://api.test/path',token:'fixture'},now));
});
test('chat trusts authoritative boolean room state, owns controls, and excludes hidden authors',async()=>{
  const calls=[];
  const messages=[{id:id(5),body:'Visible',user_id:id(20),created_at:'2026-11-18T12:00:00Z'},{id:id(6),body:'Hidden',user_id:id(21),created_at:'2026-11-18T11:59:00Z'}];
  const db=client(async(input,options)=>{const url=new URL(String(input));calls.push({url,options});return Response.json(url.pathname.endsWith('/fan_live_chat_room_open')?true:url.pathname.endsWith('/fan_live_chat_user_controls')?[{target_user_id:id(21),is_muted:true,is_blocked:false}]:url.pathname.endsWith('/fan_live_chat_messages')?messages:[{id:id(20),display_name:'Visible member'}]);});
  const room=await readGameRoom(db,id(1),id(30));assert.equal(room.open,true);assert.deepEqual(room.messages.map(x=>x.body),['Visible']);
  const controls=calls.find(c=>c.url.pathname.endsWith('/fan_live_chat_user_controls')).url.searchParams;assert.equal(controls.get('user_id'),`eq.${id(30)}`);
  const query=calls.find(c=>c.url.pathname.endsWith('/fan_live_chat_messages')).url.searchParams;assert.equal(query.get('game_id'),`eq.${id(1)}`);assert.equal(query.get('order'),'created_at.desc,id.desc');assert.equal(query.get('limit'),'200');
  assert.ok(!calls.at(-1).url.searchParams.get('id').includes(id(21)));
  for(const flag of [false,'true']){
    const paths=[];const closed=client(async input=>{const p=new URL(String(input)).pathname;paths.push(p);return Response.json(p.endsWith('/fan_live_chat_room_open')?flag:[]);});
    if(flag===false)assert.equal((await readGameRoom(closed,id(1),id(30))).messages.length,0);else await assert.rejects(readGameRoom(closed,id(1),id(30)));
    assert.ok(!paths.includes('/rest/v1/fan_live_chat_messages'));
  }
});
test('sending checks room, retains server slow-mode and owns exact game/user body',async()=>{
  const calls=[];const db=client(async(input,options)=>{const url=new URL(String(input));calls.push({url,options});return Response.json(url.pathname.includes('/rpc/')?true:{id:id(5),user_id:id(30),body:'Hello',created_at:now.toISOString()});});
  await sendGameMessage(db,id(1),id(30),' Hello ');assert.deepEqual(JSON.parse(calls[1].options.body),{game_id:id(1),user_id:id(30),body:'Hello'});
  await assert.rejects(sendGameMessage(db,id(1),id(30),'x'.repeat(501)));assert.equal(calls.length,2);
  const slow=client(async input=>String(input).includes('/rpc/')?Response.json(true):Response.json({message:'SLOW_MODE'},{status:400}));await assert.rejects(sendGameMessage(slow,id(1),id(30),'Hello'),/two seconds.*retained/);
  const closed=client(async()=>Response.json(false));await assert.rejects(sendGameMessage(closed,id(1),id(30),'Hello'),/closed/);
});
test('block/mute and reporting preserve owned identity and reject invalid/self targets before writes',async()=>{
  const calls=[];const db=client(async(input,options)=>{calls.push({url:new URL(String(input)),options});return new Response(null,{status:204});});
  await setGameChatControl(db,id(30),id(20),true,false);let body=JSON.parse(calls[0].options.body);assert.equal(body.user_id,id(30));assert.equal(body.target_user_id,id(20));assert.equal(body.is_blocked,true);assert.equal(body.is_muted,false);
  const message={id:id(5),user_id:id(20),body:'Text',created_at:now.toISOString()};
  await reportGameMessage(db,id(1),id(30),message,'spam',' context ');assert.deepEqual(JSON.parse(calls[1].options.body),{game_id:id(1),reporter_id:id(30),message_id:id(5),reported_user_id:id(20),reason:'spam',details:'context'});
  await assert.rejects(setGameChatControl(db,id(30),id(30),true,false));await assert.rejects(reportGameMessage(db,id(1),id(20),message,'spam',''));await assert.rejects(reportGameMessage(db,id(1),id(30),message,'anything',''));assert.equal(calls.length,2);
});
test('predictions use verified server state and never fabricate lock, counts or results',async()=>{
  const data={my_pick:null,locked:false,total_picks:0,results:null};const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return Response.json(data);};
  assert.deepEqual(await readPrediction('https://api.test','token',id(1),fetcher),data);
  assert.equal(calls[0].options.headers.Authorization,'Bearer token');
  for(const invalid of [{...data,locked:'false'},{...data,total_picks:-1},{...data,results:{winner_team_id:id(10),total_picks:1,correct_picks:1,winner_percent:101}}])await assert.rejects(readPrediction('https://api.test','token',id(1),async()=>Response.json(invalid)));
  await pickGameWinner('https://api.test','token',id(1),id(10),async(_,options)=>{assert.deepEqual(JSON.parse(options.body),{gameId:id(1),pickedTeamId:id(10)});return Response.json({ok:true,picked_team_id:id(10)});});
  await assert.rejects(pickGameWinner('https://api.test','token',id(1),id(10),async()=>Response.json({error:'locked'},{status:409})),/locked/);
});
