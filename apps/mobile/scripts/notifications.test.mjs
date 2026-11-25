import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { readNotifications, markNotificationsRead, notificationPath, noticeMatches, noticeSearchMatches } from '../src/native/notifications.ts';
const uid='11111111-1111-4111-8111-111111111111';
test('alerts read and mark actual read_at fields only for authenticated viewer',async()=>{
  const calls=[];
  const db=createClient('https://fixture.supabase.co','key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,options)=>{calls.push({url:new URL(String(input)),options});return Response.json([{id:'notice'}]);}}});
  await readNotifications(db,uid);
  const q=calls[0].url.searchParams;
  assert.equal(q.get('user_id'),`eq.${uid}`);assert.equal(q.get('limit'),'100');assert.equal(q.get('order'),'created_at.desc,id.desc');
  assert.equal(q.get('select'),'id,target_type,target_id,notification_type,title,body,read_at,created_at');
  assert.deepEqual(await markNotificationsRead(db,uid,new Date('2026-11-18T00:00:00Z')),{ids:['notice'],readAt:'2026-11-18T00:00:00.000Z'});
  assert.equal(calls[1].options.method,'PATCH');assert.equal(calls[1].url.searchParams.get('user_id'),`eq.${uid}`);assert.equal(calls[1].url.searchParams.get('read_at'),'is.null');
  assert.deepEqual(JSON.parse(calls[1].options.body),{read_at:'2026-11-18T00:00:00.000Z'});
  await assert.rejects(readNotifications(db,'invalid'));await assert.rejects(markNotificationsRead(db,'invalid'));assert.equal(calls.length,2);
});
test('alert targets cannot inject routes and filters match mobile website',()=>{
  for(const [type,path]of[['team','/teams/abc'],['coach','/coaches/abc'],['league','/leagues/abc'],['game','/fan-live?gameId=abc']])assert.equal(notificationPath({target_type:type,target_id:'abc'}),path);
  for(const target of ['../account','abc?token=x','https://other.test'])assert.equal(notificationPath({target_type:'team',target_id:target}),null);
  assert.equal(notificationPath({target_type:'unknown',target_id:'abc'}),null);
  const notice={target_type:'team',notification_type:'review',read_at:null};
  assert.equal(noticeMatches(notice,'reviews'),true);assert.equal(noticeMatches(notice,'unread'),true);assert.equal(noticeMatches(notice,'clubs'),false);assert.equal(noticeMatches(notice,'games'),false);
});
test('denied alert reads and writes report failures without pretending success',async()=>{
  const db=createClient('https://fixture.supabase.co','key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async()=>Response.json({message:'denied'},{status:403})}});
  await assert.rejects(readNotifications(db,uid));await assert.rejects(markNotificationsRead(db,uid));
});

test('notification history uses viewer-scoped stable timestamp and ID keyset; rejects unsafe cursors',async()=>{
  const calls=[];
  const db=createClient('https://fixture.supabase.co','key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input)=>{calls.push(new URL(String(input)));return Response.json([]);}}});
  const before={id:'22222222-2222-4222-8222-222222222222',created_at:'2026-11-24T10:20:30.123456+00:00'};
  await readNotifications(db,uid,before);
  assert.equal(calls[0].searchParams.get('user_id'),`eq.${uid}`);
  assert.equal(calls[0].searchParams.get('limit'),'100');
  assert.equal(calls[0].searchParams.get('order'),'created_at.desc,id.desc');
  assert.equal(calls[0].searchParams.get('or'),`(created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id}))`);
  await assert.rejects(readNotifications(db,uid,{...before,id:'bad,or'}));
  await assert.rejects(readNotifications(db,uid,{...before,created_at:'2026-11-24T10:20:30Z),id.gt.0'}));
  assert.equal(calls.length,1);
});
test('marking a single alert keeps user scope and preserves other unread alerts',async()=>{
  const id='22222222-2222-4222-8222-222222222222';
  const calls=[];
  const db=createClient('https://fixture.supabase.co','key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input)=>{calls.push(new URL(String(input)));return Response.json([{id}]);}}});
  const now=new Date('2026-11-24T10:20:30Z');
  assert.deepEqual(await markNotificationsRead(db,uid,now,id),{ids:[id],readAt:now.toISOString()});
  assert.equal(calls[0].searchParams.get('user_id'),`eq.${uid}`);
  assert.equal(calls[0].searchParams.get('id'),`eq.${id}`);
  assert.equal(calls[0].searchParams.get('read_at'),'is.null');
});

test('alert search matches loaded text and type, combines terms, and treats input literally',()=>{
  const notice={title:'Team update',body:'New review from a verified player',notification_type:'trust_score'};
  for(const query of ['', '   ', ' TEAM ', 'verified player', 'team TRUST score']) assert.equal(noticeSearchMatches(notice,query),true);
  for(const query of ['unknown', 'team unknown', '.*', 'review,or']) assert.equal(noticeSearchMatches(notice,query),false);
});
