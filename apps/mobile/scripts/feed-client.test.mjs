import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { readFeedPage, readSharedFeedPost, readFeedComments, moderateFeedText, publishFeedPoll, validatedPollOptions, authorizedFeedMedia, toggleFeedCheck, readFeedChecks, readFeedSaved, feedAction, deleteOwnedFeedPost, sendFeedShare } from '../src/native/feedClient.ts';
const uid = '11111111-1111-4111-8111-111111111111';
const id = n => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
const now = new Date('2026-11-18T12:00:00Z');
const post = n => ({ id: id(n), created_at: `2026-11-17T12:00:${String(59-n).padStart(2,'0')}Z`, author_id: uid, body: 'Fixture', expires_at: null, profiles: [{ display_name: 'Member' }] });
const client = request => createClient('https://fixture.supabase.co', 'fixture-key', { auth: { persistSession:false,autoRefreshToken:false,detectSessionInUrl:false }, global:{fetch:request} });
test('native polls use only moderated canonical fields and require acknowledged publication', async () => {
  let call;const request=async(url,options)=>{call={url,options};return Response.json({allowed:true});};
  await publishFeedPoll('https://api.test','token',' Question? ',[' Home ',' Away '],request);
  assert.equal(call.url,'https://api.test/api/hoopfeed/moderate');assert.equal(call.options.headers.Authorization,'Bearer token');assert.equal(call.options.cache,'no-store');assert.equal(call.options.redirect,'error');
  assert.deepEqual(Object.fromEntries(call.options.body),{kind:'post',text:'Question?',post_kind:'poll',poll_options:'["Home","Away"]',audience:'community'});
  for(const options of [[],['one'],['one','two','three','four','five'],['Home',' home '],['a',''],['a','b'.repeat(61)],[1,'b']])assert.throws(()=>validatedPollOptions(options));
  await assert.rejects(publishFeedPoll('https://api.test','token','',['a','b'],request));
  await assert.rejects(publishFeedPoll('https://api.test','token','Question',['a','b'],async()=>Response.json({allowed:false,message:'Moderation declined'},{status:400})),/Moderation declined/);
  await assert.rejects(publishFeedPoll('https://api.test','token','Question',['a','b'],async()=>Response.json({allowed:'true'})),/could not be confirmed/);
});
test('feed uses approved unexpired rows, deterministic keyset pages and viewer-only archives', async () => {
  const calls = [];
  const rows = Array.from({length:21}, (_,i) => post(i));
  rows[1].expires_at = '2026-11-18T11:00:00Z';
  const db = client(async (input, options) => {
    const url = new URL(String(input)); calls.push({url,options});
    return Response.json(url.pathname.endsWith('/feed_posts') ? rows : [{post_id:id(0)}]);
  });
  const page = await readFeedPage(db, uid, undefined, true, now);
  assert.equal(page.posts.length,18);
  assert.equal(page.posts[0].profiles.display_name,'Member');
  assert.deepEqual(page.next, {id:id(19),created_at:rows[19].created_at});
  const query=calls[0].url.searchParams;
  assert.equal(query.get('status'),'eq.approved');
  assert.equal(query.get('or'),'(expires_at.is.null,expires_at.gt.2026-11-18T12:00:00.000Z)');
  assert.equal(query.get('order'),'created_at.desc,id.desc');
  assert.equal(query.get('limit'),'21');
  assert.equal(query.get('video_url'),'not.is.null');
  assert.ok(!/email|subscription|salary/.test(query.get('select')));
  assert.equal(calls[1].url.searchParams.get('user_id'),`eq.${uid}`);
  assert.ok(!calls[1].url.searchParams.get('post_id').includes(id(20)));
  calls.length=0;
  await readFeedPage(db,uid,page.next,false,now);
  assert.ok(calls[0].url.searchParams.getAll('or')[1].includes(`id.lt.${id(19)}`));
});
test('invalid cursors and identities fail before querying; unavailable archives fail closed', async () => {
  let count=0;const db=client(async()=>{count++;return Response.json([]);});
  for(const cursor of [{id:id(1),created_at:'2026-11-18T00:00:00Z),status.eq.hidden'}, {id:'bad',created_at:now.toISOString()}]) await assert.rejects(readFeedPage(db,uid,cursor));
  await assert.rejects(readFeedPage(db,'other'));
  assert.equal(count,0);
  await assert.rejects(readFeedPage(client(async input=>String(input).includes('archives')?Response.json({message:'denied'},{status:403}):Response.json([post(1)])),uid));
});
test('shared posts and comments preserve exact targets, expiry, own archive and bounded paging',async()=>{
  const calls=[];
  const db=client(async input=>{const u=new URL(String(input));calls.push(u);return Response.json(u.pathname.endsWith('/feed_posts')?post(1):u.pathname.endsWith('/feed_post_comments')?Array.from({length:51},(_,i)=>({...post(i),parent_id:null})):null);});
  assert.equal((await readSharedFeedPost(db,uid,id(1),now)).id,id(1));
  assert.equal(calls[0].searchParams.get('id'),`eq.${id(1)}`);
  assert.equal(calls[1].searchParams.get('user_id'),`eq.${uid}`);
  const result=await readFeedComments(db,id(1),50);
  assert.equal(result.comments.length,50);assert.equal(result.more,true);
  assert.equal(calls[2].searchParams.get('post_id'),`eq.${id(1)}`);
  assert.equal(calls[2].searchParams.get('offset'),'50');assert.equal(calls[2].searchParams.get('limit'),'51');
  const expired=client(async()=>Response.json({...post(1),expires_at:now.toISOString()}));
  assert.equal(await readSharedFeedPost(expired,uid,id(1),now),null);
});
test('posts and replies use existing moderation, strict success and allowlisted published comment',async()=>{
  const requests=[];
  const request=async(url,options)=>{requests.push({url,options});return Response.json({allowed:true,comment:{...post(2),post_id:id(1),parent_id:id(0),secret:'discard'}});};
  await moderateFeedText('https://api.test','token','post','  Hello  ',undefined,request);
  assert.equal(requests[0].options.body.get('text'),'Hello');
  assert.equal(requests[0].options.body.get('audience'),'community');
  const comment=await moderateFeedText('https://api.test','token','comment','Reply',id(1),request,id(0));
  assert.equal(comment.parent_id,id(0));assert.equal(comment.secret,undefined);assert.equal(comment.profiles,null);
  assert.equal(requests[1].options.body.get('parent_id'),id(0));
  for(const {url,options} of requests){assert.equal(url,'https://api.test/api/hoopfeed/moderate');assert.equal(options.headers.Authorization,'Bearer token');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');}
  await assert.rejects(moderateFeedText('https://api.test','token','comment','x',id(1),async()=>Response.json({allowed:'true'})));
  await assert.rejects(moderateFeedText('https://api.test','token','post','x'.repeat(2001),undefined,request));
  await assert.rejects(moderateFeedText('http://api.test','token','post','x',undefined,request));
  assert.equal(requests.length,2);
});
test('media accepts only authorized signed URLs from the configured project',async()=>{
  let calls=0;
  const run=url=>authorizedFeedMedia('https://api.test','https://fixture.supabase.co','token',id(1),'protected/path',undefined,async(_,options)=>{
    calls++;assert.deepEqual(JSON.parse(options.body),{post_id:id(1),media_url:'protected/path'});assert.equal(options.cache,'no-store');return Response.json({url});
  });
  assert.equal(await run('https://fixture.supabase.co/storage/v1/object/sign/feed/photo?token=test'),'https://fixture.supabase.co/storage/v1/object/sign/feed/photo?token=test');
  for(const url of ['https://evil.test/storage/v1/object/sign/x','https://fixture.supabase.co/storage/v1/object/public/x','http://fixture.supabase.co/storage/v1/object/sign/x'])await assert.rejects(run(url));
  await assert.rejects(authorizedFeedMedia('https://api.test','https://fixture.supabase.co/path','token',id(1),'ref',undefined,async()=>{calls++;}));
  assert.equal(calls,4);
});
test('checks and bookmarks remain scoped to caller, and counts come from actual RPC',async()=>{
  const calls=[];
  const db=client(async(input,options)=>{const url=new URL(String(input));calls.push({url,options});return options.method==='DELETE'||options.method==='POST'&&!url.pathname.includes('/rpc/')?new Response(null,{status:204}):Response.json(url.pathname.includes('/rpc/')?[{post_id:id(1),checks_count:3,checked_by_me:false}]:[{post_id:id(1)},{post_id:id(2)}]);});
  assert.equal((await toggleFeedCheck(db,uid,id(1),true))[0].checks_count,3);
  assert.equal(calls[0].url.searchParams.get('user_id'),`eq.${uid}`);assert.equal(calls[0].url.searchParams.get('post_id'),`eq.${id(1)}`);
  assert.equal(calls[1].url.pathname,'/rest/v1/rpc/get_hoopfeed_check_totals');
  await toggleFeedCheck(db,uid,id(1),false);
  assert.deepEqual(JSON.parse(calls[2].options.body),{user_id:uid,post_id:id(1)});
  assert.deepEqual(await readFeedSaved(db,uid,[id(1)]),[id(1)]);
  assert.equal(calls[4].url.searchParams.get('user_id'),`eq.${uid}`);
});
test('votes and bookmarks use server permission checks and reject invalid inputs before request',async()=>{
  const calls=[];const request=async(url,options)=>{calls.push(options.body);return Response.json({allowed:true});};
  await feedAction('https://api.test','token','vote',id(1),2,request);
  await feedAction('https://api.test','token','bookmark',id(1),false,request);
  assert.equal(calls[0].get('option_index'),'2');assert.equal(calls[1].get('saved'),'false');
  for(const [kind,value]of[['vote',-1],['vote',6],['bookmark',1]])await assert.rejects(feedAction('https://api.test','token',kind,id(1),value,request));
  assert.equal(calls.length,2);
  await assert.rejects(feedAction('https://api.test','token','vote',id(1),1,async()=>Response.json({allowed:false},{status:403})));
});

test('a post with zero Checks remains usable after a successful empty aggregate RPC',async()=>{
  const calls=[];
  const db=client(async(input,options)=>{
    const url=new URL(String(input));calls.push({url,options});
    return Response.json([]);
  });
  assert.deepEqual(await readFeedChecks(db,[id(1),id(2)]),[
    {post_id:id(1),checks_count:0,checked_by_me:false},
    {post_id:id(2),checks_count:0,checked_by_me:false},
  ]);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url.pathname,'/rest/v1/rpc/get_hoopfeed_check_totals');
  assert.deepEqual(JSON.parse(calls[0].options.body),{post_ids:[id(1),id(2)]});
  assert.deepEqual(await readFeedChecks(db,[]),[]);
  assert.equal(calls.length,1,'An empty feed does not query Checks');
});

test('Check totals preserve real RPC counts and fill only omitted zero-count posts',async()=>{
  const db=client(async()=>Response.json([{post_id:id(2),checks_count:'3',checked_by_me:true}]));
  assert.deepEqual(await readFeedChecks(db,[id(1),id(2)]),[
    {post_id:id(1),checks_count:0,checked_by_me:false},
    {post_id:id(2),checks_count:3,checked_by_me:true},
  ]);
});

test('failed or malformed Check totals never become invented zero counts',async()=>{
  const failed=client(async()=>Response.json({message:'Permission denied'},{status:403}));
  await assert.rejects(readFeedChecks(failed,[id(1)]),/Checks unavailable/);
  for(const rows of [
    null,
    [{post_id:id(1),checks_count:-1,checked_by_me:false}],
    [{post_id:id(1),checks_count:'not-a-number',checked_by_me:false}],
    [{post_id:id(1),checks_count:2,checked_by_me:'true'}],
    [{post_id:id(2),checks_count:2,checked_by_me:false}],
    [{post_id:id(1),checks_count:1,checked_by_me:true},{post_id:id(1),checks_count:1,checked_by_me:true}],
  ]) {
    const db=client(async()=>Response.json(rows));
    await assert.rejects(readFeedChecks(db,[id(1)]));
  }
});

test('a signed-in owner can delete only their own post and receives a confirmed row', async()=>{
  const calls=[];
  const db=client(async(input,options)=>{
    const url=new URL(String(input));calls.push({url,options});
    return Response.json([{id:id(1)}]);
  });
  await deleteOwnedFeedPost(db,uid,id(1));
  assert.equal(calls.length,1);
  assert.equal(calls[0].options.method,'DELETE');
  assert.equal(calls[0].url.pathname,'/rest/v1/feed_posts');
  assert.equal(calls[0].url.searchParams.get('id'),`eq.${id(1)}`);
  assert.equal(calls[0].url.searchParams.get('author_id'),`eq.${uid}`);
  assert.equal(calls[0].url.searchParams.get('select'),'id');
});

test('delete never claims success on RLS denial, zero-row response, wrong identity or invalid ids',async()=>{
  const denied=client(async()=>Response.json({message:'permission denied'},{status:403}));
  await assert.rejects(deleteOwnedFeedPost(denied,uid,id(1)),/could not be deleted/);
  const missing=client(async()=>Response.json([]));
  await assert.rejects(deleteOwnedFeedPost(missing,uid,id(1)),/could not be deleted/);
  const wrong=client(async()=>Response.json([{id:id(2)}]));
  await assert.rejects(deleteOwnedFeedPost(wrong,uid,id(1)),/could not be deleted/);
  let calls=0;
  const noNetwork=client(async()=>{calls++;return Response.json([]);});
  await assert.rejects(deleteOwnedFeedPost(noNetwork,'bad',id(1)));
  await assert.rejects(deleteOwnedFeedPost(noNetwork,uid,'bad'));
  assert.equal(calls,0);
});

test('share delivery sends only the two IDs and requires explicit server acknowledgement',async()=>{
  const calls=[];const request=async(url,options)=>{calls.push({url,options});return Response.json({ok:true});};
  await sendFeedShare('https://api.test','token',id(1),id(2),undefined,request);
  assert.equal(calls[0].url,'https://api.test/api/hoopfeed/share');
  assert.equal(calls[0].options.headers.Authorization,'Bearer token');
  assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.cache,'no-store');
  assert.deepEqual(JSON.parse(calls[0].options.body),{post_id:id(1),recipient_id:id(2)});
  await assert.rejects(sendFeedShare('https://api.test','token',id(1),'bad',undefined,request));assert.equal(calls.length,1);
  await assert.rejects(sendFeedShare('https://api.test','token',id(1),id(2),undefined,async()=>Response.json({ok:false,message:'Not eligible'},{status:403})),/Not eligible/);
  await assert.rejects(sendFeedShare('https://api.test','token',id(1),id(2),undefined,async()=>Response.json({ok:'true'})),/could not be confirmed/);
});

test("optional post location is explicitly entered, bounded, and never attached to comments",async()=>{
  const requests=[];const request=async(url,options)=>{requests.push(options.body);return Response.json({allowed:true});};
  await moderateFeedText("https://api.test","token","post","Hello",undefined,request,undefined,"  Arena  ");
  await publishFeedPoll("https://api.test","token","Question?",["A","B"],request,"  City  ");
  assert.equal(requests[0].get("post_location"),"Arena");assert.equal(requests[1].get("post_location"),"City");
  assert.equal(requests[0].has("share_country"),false);
  await assert.rejects(moderateFeedText("https://api.test","token","comment","Reply",id(1),request,undefined,"City"));
  await assert.rejects(publishFeedPoll("https://api.test","token","Question?",["A","B"],request,"x".repeat(101)));
  assert.equal(requests.length,2);
});
