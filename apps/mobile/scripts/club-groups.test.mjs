import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { readClubGroups, readClubGroupAccess, readClubGroupPosts, readGroupComments, clubGroupAction, signedGroupImage } from '../src/native/clubGroups.ts';
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const client=request=>createClient('https://fixture.supabase.co','key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:request}});
test('club directory preserves canonical groups, bounded sanitized search and stable lookahead pages',async()=>{
 let call;const db=client(async input=>{call=new URL(String(input));return Response.json(Array.from({length:25},(_,n)=>({team_id:id(n),group_name:`Club ${n}`})));});
 const result=await readClubGroups(db,'Club%(),_',2);assert.equal(result.groups.length,24);assert.equal(result.more,true);
 assert.equal(call.searchParams.get('select'),'team_id,group_name');assert.equal(call.searchParams.get('order'),'group_name.asc,team_id.asc');assert.equal(call.searchParams.get('offset'),'48');assert.equal(call.searchParams.get('limit'),'25');assert.equal(call.searchParams.get('group_name'),'ilike.%Club%');
 await assert.rejects(readClubGroups(db,'Club',-1));
});
test('summary membership cannot replace caller-owned row and moderator RPC must be a boolean',async()=>{
 const calls=[];const db=client(async(input,options)=>{const url=new URL(String(input));calls.push({url,options});const table=url.pathname.split('/').pop();return Response.json(table==='get_team_fan_group_summary'?[{group_name:'Club Group',member_count:'3',is_member:true}]:table==='is_team_fan_group_moderator'?false:table==='team_fan_group_members'?null:{name:'Women Club',basketball_type:'womens'});});
 const access=await readClubGroupAccess(db,id(1),id(30));assert.equal(access.member,false);assert.equal(access.moderator,false);assert.equal(access.memberCount,3);assert.equal(access.teamPath,`/womens/${id(1)}`);
 const owned=calls.find(c=>c.url.pathname.endsWith('/team_fan_group_members')).url.searchParams;assert.equal(owned.get('user_id'),`eq.${id(30)}`);assert.equal(owned.get('team_id'),`eq.${id(1)}`);
 assert.ok(calls.filter(c=>c.url.pathname.includes('/rpc/')).every(c=>JSON.parse(c.options.body).p_team_id===id(1)));
 const invalid=client(async input=>String(input).endsWith('/is_team_fan_group_moderator')?Response.json('true'):Response.json([]));await assert.rejects(readClubGroupAccess(invalid,id(1),id(30)));
});
test('private posts keep group/status filters, pinned ordering, public authors and permanent history',async()=>{
 let call;const rows=Array.from({length:25},(_,n)=>({id:id(n+100),team_id:id(1),author_id:id(30),body:'Post',image_url:null,is_pinned:false,created_at:'2026-11-18T12:00:00Z',profiles:[{display_name:'Member'}]}));
 const db=client(async input=>{call=new URL(String(input));return Response.json(rows);});const result=await readClubGroupPosts(db,id(1),1);
 assert.equal(result.posts.length,24);assert.equal(result.more,true);assert.equal(result.posts[0].profiles.display_name,'Member');
 assert.equal(call.searchParams.get('team_id'),`eq.${id(1)}`);assert.equal(call.searchParams.get('status'),'eq.published');assert.equal(call.searchParams.get('order'),'is_pinned.desc,created_at.desc,id.desc');assert.equal(call.searchParams.get('offset'),'24');assert.equal(call.searchParams.get('limit'),'25');assert.equal(call.searchParams.has('expires_at'),false);assert.ok(!/email|avatar|subscription/.test(call.searchParams.get('select')));
 await assert.rejects(readClubGroupPosts(client(async()=>Response.json([{...rows[0],team_id:id(2)}])),id(1)));
});
test('comments retain exact authorized post and bounded deterministic paging',async()=>{
 let url;const db=client(async input=>{url=new URL(String(input));return Response.json([{id:id(9),post_id:id(100),body:'Reply',author_id:id(30),created_at:'2026-11-18T12:00:00Z',profiles:[{display_name:'Member'}]}]);});
 const result=await readGroupComments(db,id(100),2);assert.equal(result.comments[0].profiles.display_name,'Member');assert.equal(url.searchParams.get('post_id'),`eq.${id(100)}`);assert.equal(url.searchParams.get('offset'),'100');assert.equal(url.searchParams.get('limit'),'51');assert.equal(url.searchParams.get('order'),'created_at.asc,id.asc');
});
test('all group mutations retain server authorization/moderation and fail closed',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return Response.json({ok:true});};
 for(const [action,values]of[['join',{}],['leave',{}],['create_post',{text:' Hello '}],['comment',{text:'Reply',postId:id(100)}],['report_post',{text:'Spam report',postId:id(100)}],['pin_post',{postId:id(100)}],['remove_post',{postId:id(100)}]])await clubGroupAction('https://api.test','token',id(1),action,values,fetcher);
 for(const call of calls){assert.equal(call.url,'https://api.test/api/fan-groups');assert.equal(call.options.headers.Authorization,'Bearer token');assert.equal(call.options.cache,'no-store');assert.equal(call.options.redirect,'error');assert.equal(call.options.body.get('team_id'),id(1));}
 assert.equal(calls[2].options.body.get('body'),'Hello');assert.equal(calls[4].options.body.get('reason'),'Spam report');
 await assert.rejects(clubGroupAction('https://api.test','token',id(1),'grant_owner',{},fetcher));await assert.rejects(clubGroupAction('https://api.test','token',id(1),'comment',{text:'x'.repeat(1001),postId:id(100)},fetcher));assert.equal(calls.length,7);
 await assert.rejects(clubGroupAction('https://api.test','token',id(1),'join',{},async()=>Response.json({ok:'true'})));
 await assert.rejects(clubGroupAction('https://api.test','token',id(1),'create_post',{text:'Hello'},async()=>Response.json({ok:false,message:'Moderation rejected'},{status:400})),/Moderation/);
});
test('group images use owned group paths, storage RLS and exact signed URL targets',async()=>{
 const reference=`${id(1)}/${id(30)}/fixture.jpg`;let count=0;
 const db=client(async(input,options)=>{count++;const url=new URL(String(input));assert.equal(url.pathname,`/storage/v1/object/sign/fan-group-images/${reference}`);assert.equal(JSON.parse(options.body).expiresIn,600);return Response.json({signedURL:`/object/sign/fan-group-images/${reference}?token=fixture`});});
 const url=await signedGroupImage(db,'https://fixture.supabase.co',id(1),reference);assert.equal(url,`https://fixture.supabase.co/storage/v1/object/sign/fan-group-images/${reference}?token=fixture`);
 for(const path of [`${id(2)}/${id(30)}/fixture.jpg`,`${id(1)}/../file.jpg`,'https://evil.test/image.jpg'])await assert.rejects(signedGroupImage(db,'https://fixture.supabase.co',id(1),path));assert.equal(count,1);
 const wrong=client(async()=>Response.json({signedURL:'/object/sign/fan-group-images/other/file.jpg?token=fixture'}));await assert.rejects(signedGroupImage(wrong,'https://fixture.supabase.co',id(1),reference));
});
test('permission read failures cannot silently reuse group membership',async()=>{
 const db=client(async()=>Response.json({message:'denied'},{status:403}));await assert.rejects(readClubGroupAccess(db,id(1),id(30)));await assert.rejects(readClubGroupPosts(db,id(1)));await assert.rejects(readGroupComments(db,id(100)));
});
