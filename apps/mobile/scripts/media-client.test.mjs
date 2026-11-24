import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishMediaPost, PublicationUnconfirmed } from '../src/native/mediaClient.ts';
import { readWithDeadline } from '../src/native/readDeadline.ts';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
const compiled = ts.transpileModule(readFileSync(new URL('../src/native/avatarClient.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('require', 'exports', compiled)(id => { assert.equal(id, './readDeadline'); return { readWithDeadline }; }, exports);
const { saveOwnAvatar } = exports;
const owner='11111111-1111-4111-8111-111111111111', object='22222222-2222-4222-8222-222222222222';
const photo={uri:'file:///private/selected.jpg',name:'photo.jpg',type:'image/jpeg',size:5,width:720,height:720};
const video={uri:'file:///private/selected.mov',name:'video.mov',type:'video/quicktime',size:100};
const signal=()=>new AbortController().signal;
const json=(value,status=200)=>Response.json(value,{status});
const ticket={mode:'private',path:`${owner}/${object}.mov`,bucket:'hoopfeed-private-videos',token:'private-upload-token'};
const base={photoBody:async()=>new Blob(['photo'],{type:'image/jpeg'}),uploadVideo:async()=>({status:200})};
const publish=(photos,clip,transport,caption='Caption')=>publishMediaPost('https://api.test','https://fixture.supabase.co',owner,'owner-token',caption,photos,clip,signal(),{...base,...transport});

test('photos use the existing moderated multipart endpoint without leaking auth in URLs or granting roles',async()=>{
 await publish([photo,photo],null,{request:async(url,init)=>{
  assert.equal(String(url),'https://api.test/api/hoopfeed/moderate');assert.equal(init.headers.Authorization,'Bearer owner-token');assert.equal(init.redirect,'error');
  assert.equal(init.body.get('kind'),'post');assert.equal(init.body.get('post_kind'),'discussion');assert.equal(init.body.get('audience'),'community');assert.equal(init.body.get('text'),'Caption');
  assert.equal(init.body.get('image').type,'image/jpeg');assert.equal(init.body.getAll('images').length,1);assert.equal(init.body.has('poll_options'),false);
  return json({allowed:true});
 }});
});

test('invalid counts, sizes and mixed media fail before uploads or HTTP requests',async()=>{
 let requests=0; const transport={request:async()=>{requests++;throw Error('must not run');}};
 for(const [photos,clip] of [[[],null],[[photo,photo,photo,photo,photo],null],[[{...photo,size:750001}],null],[[photo],video],[[],{...video,size:-1}],[[],{...video,size:50*1024*1024+1}]])await assert.rejects(publish(photos,clip,transport));
 await assert.rejects(publish([],video,transport,'')); assert.equal(requests,0);
});

test('private video upload accepts only the captured owner and trusted storage origin',async()=>{
 const calls=[];await publish([],video,{uploadVideo:async(url,headers,clip)=>{
  const target=new URL(url);assert.equal(target.origin,'https://fixture.supabase.co');assert.equal(target.pathname,`/storage/v1/object/upload/sign/hoopfeed-private-videos/${ticket.path}`);assert.equal(target.searchParams.get('token'),ticket.token);assert.equal(headers['x-upsert'],'false');assert.equal(clip,video);calls.push('upload');return {status:200};
 },request:async(url,init)=>{
  if(String(url).endsWith('/video-upload')){assert.deepEqual(JSON.parse(init.body),{content_type:'video/quicktime',size:100});calls.push('ticket');return json(ticket);}
  assert.equal(init.body.get('video_path'),`hoopfeed-private-videos/${ticket.path}`);assert.equal(init.body.get('video_type'),'video/quicktime');assert.equal(init.body.has('image'),false);calls.push('moderate');return json({allowed:true});
 }});assert.deepEqual(calls,['ticket','upload','moderate']);
 let uploads=0;
 for(const bad of [{...ticket,path:`${object}/${object}.mov`},{...ticket,path:`${owner}/../${object}.mov`},{...ticket,bucket:'public'},{...ticket,path:`${owner}/${object}.mp4`},{...ticket,mode:'public'}])await assert.rejects(publish([],video,{request:async()=>json(bad),uploadVideo:async()=>{uploads++;return {status:200};}}));assert.equal(uploads,0);
});

test('failed uploads and definitive moderation rejections clean up only the owned private path',async()=>{
 for(const failedUpload of [true,false]){
  const calls=[];
  await assert.rejects(publish([],video,{uploadVideo:async()=>({status:failedUpload?503:200}),request:async(url,init)=>{
   const path=new URL(url).pathname;calls.push(path);
   if(path.endsWith('/video-upload'))return json(ticket);
   if(path.endsWith('/video-cleanup')){assert.equal(init.method,'DELETE');assert.deepEqual(JSON.parse(init.body),{path:ticket.path});assert.equal(init.headers.Authorization,'Bearer owner-token');return json({removed:true});}
   return json({allowed:false,message:'Rejected by existing safety checks'},403);
  }}),failedUpload?/upload failed/:/safety checks/);
  assert.equal(calls.at(-1),'/api/hoopfeed/video-cleanup');assert.equal(calls.includes('/api/hoopfeed/moderate'),!failedUpload);
 }
});

test('uncertain publication retains the uploaded video and reports review before retry',async()=>{
 for(const mode of ['timeout','invalid-json','server-error']){
  let cleaned=false;
  await assert.rejects(publish([],video,{request:async(url)=>{
   const path=new URL(url).pathname;if(path.endsWith('/video-upload'))return json(ticket);
   if(path.endsWith('/video-cleanup')){cleaned=true;return json({removed:true});}
   if(mode==='timeout')throw Error('network lost after request');
   return mode==='invalid-json'?new Response('unknown',{status:200}):json({allowed:false},503);
  }}),PublicationUnconfirmed);assert.equal(cleaned,false);
 }
});

function authClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'captured-a'}}}),getUser:async token=>{assert.equal(token,'captured-a');return {data:{user:{id:owner}},error:null};}}};}

test('avatar upload and profile update use a captured JWT, exact own filter and no moderation/identity fields',async()=>{
 const writes=[];const client=authClient();
 const result=await saveOwnAvatar(client,owner,photo,'https://fixture.supabase.co','public-key',base.photoBody,async(url,init)=>{
  assert.equal(init.headers.Authorization,'Bearer captured-a');assert.equal(init.headers.apikey,'public-key');assert.equal(init.redirect,'error');writes.push(init.method);
  if(init.method==='POST'){assert.match(url,new RegExp(`/profile-avatars/${owner}/avatar-`));client.auth.getSession=async()=>({data:{session:{user:{id:object},access_token:'different-account'}}});return json({Key:'uploaded'});}
  assert.ok(url.includes(`id=eq.${owner}&select=`));const patch=JSON.parse(init.body);assert.deepEqual(Object.keys(patch),['avatar_url']);assert.match(patch.avatar_url,new RegExp(`^https://fixture.supabase.co/storage/v1/object/public/profile-avatars/${owner}/`));
  return json([{id:owner,avatar_url:patch.avatar_url,avatar_moderation_status:'rejected'}]);
 });assert.deepEqual(writes,['POST','PATCH']);assert.equal(result.status,'rejected');
});

test('avatar ownership failure makes no writes and an uncertain profile response never deletes its upload',async()=>{
 let writes=0;const client=authClient();client.auth.getUser=async()=>({data:{user:{id:object}}});
 await assert.rejects(saveOwnAvatar(client,owner,photo,'https://fixture.supabase.co','public-key',base.photoBody,async()=>{writes++;return json({});}),/verified/);assert.equal(writes,0);
 const calls=[];await assert.rejects(saveOwnAvatar(authClient(),owner,photo,'https://fixture.supabase.co','public-key',base.photoBody,async(_,init)=>{calls.push(init.method);if(init.method==='POST')return json({Key:'uploaded'});throw Error('network lost');}));assert.deepEqual(calls,['POST','PATCH']);
});
