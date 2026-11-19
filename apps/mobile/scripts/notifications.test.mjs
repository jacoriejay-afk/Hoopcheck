import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { readNotifications, markNotificationsRead, notificationPath, noticeMatches } from '../src/native/notifications.ts';
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
