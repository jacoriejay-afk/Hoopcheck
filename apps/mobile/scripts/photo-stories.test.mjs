import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { readPhotoStories,publishPhotoStory,storyVisible,appendStoryPhoto,adjacentStoryId } from "../src/native/photoStories.ts";
import { resolveStoryPhoto } from "../src/native/storyPhotoReference.ts";
const uid="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const now=new Date("2026-11-27T12:00:00Z"),id=n=>"33333333-3333-4333-8333-"+String(n).padStart(12,"0");
const photoRef="hoopfeed-private-images/"+uid+"/"+id(99)+".jpg";
const row=n=>({id:id(n),author_id:uid,body:"Training",image_url:photoRef,image_urls:[photoRef],status:"approved",video_url:null,post_kind:"story",community_visible:false,created_at:"2026-11-27T10:00:00Z",expires_at:"2026-11-28T10:00:00Z",profiles:{display_name:"Member"}});
function fixture(changed=false){
 const calls=[];let sessions=0;
 const db=createClient("https://fixture.supabase.co","fixture",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async input=>{
 const url=new URL(String(input));calls.push(url);
 if(url.pathname.endsWith("/feed_posts"))return Response.json([row(0),{...row(1),author_id:other,image_url:photoRef.replace(uid,other),image_urls:[photoRef.replace(uid,other)]},{...row(2),community_visible:true},{...row(3),expires_at:"2026-11-27T11:00:00Z"},{...row(4),post_kind:"discussion"},row(5),{...row(6),status:"pending"},{...row(7),image_urls:[photoRef,photoRef]},{...row(8),image_url:"https://example.test/photo.jpg",image_urls:["https://example.test/photo.jpg"]}]);
 if(url.pathname.endsWith("/user_blocks"))return Response.json([{blocked_id:other}]);
 if(url.pathname.endsWith("/feed_post_archives"))return Response.json([{post_id:id(5)}]);
 throw Error("Unexpected request");
 }}});
 db.auth.getSession=async()=>({error:null,data:{session:{user:{id:uid},access_token:changed&&sessions++?"changed":"token"}}});
 db.auth.getUser=async()=>({error:null,data:{user:{id:uid}}});
 return {db,calls};
}
test("read only approved follower-scoped unexpired photos, exclude archive and blocked rows",async()=>{
 const {db,calls}=fixture();const page=await readPhotoStories(db,uid,new AbortController().signal,undefined,now);
 assert.deepEqual(page.stories.map(x=>x.id),[id(0)]);
 assert.equal(calls[0].searchParams.get("post_kind"),"eq.story");assert.equal(calls[0].searchParams.get("community_visible"),"eq.false");
 assert.equal(calls[0].searchParams.get("expires_at"),"gt."+now.toISOString());
 assert.equal(calls.find(x=>x.pathname.endsWith("/user_blocks")).searchParams.get("blocker_id"),"eq."+uid);
 assert.equal(storyVisible(page.stories[0],Date.parse("2026-11-28T10:00:00Z")),false);
 await assert.rejects(readPhotoStories(fixture(true).db,uid,new AbortController().signal,undefined,now),/Account changed/);
 const wrong=fixture();wrong.db.auth.getUser=async()=>({error:null,data:{user:{id:other}}});
 await assert.rejects(readPhotoStories(wrong.db,uid,new AbortController().signal,undefined,now),/Verify your account/);
 assert.equal(wrong.calls.length,0);
});
test("single photo publication sends explicit follower audience, no client expiry, and requires acknowledgement",async()=>{
 const photo={uri:"file:///private/photo.jpg",name:"photo.jpg",type:"image/jpeg",size:4,width:720,height:720};
 const args=["https://api.test",uid,"token","Training",photo,new AbortController().signal,async()=>new Blob(["data"],{type:"image/jpeg"})];
 const expiry=new Date(Date.now()+86400000).toISOString();
 assert.equal(await publishPhotoStory(...args,async(url,options)=>{
 assert.equal(String(url),"https://api.test/api/hoopfeed/moderate");assert.equal(options.headers.Authorization,"Bearer token");
 assert.equal(options.body.get("post_kind"),"story");assert.equal(options.body.get("audience"),"followers");
 assert.equal(options.body.has("expires_at"),false);assert.equal(options.body.has("video_path"),false);assert.equal(options.body.getAll("image").length,1);
 return Response.json({allowed:true,story_expires_at:expiry});
 }),expiry);
 await assert.rejects(publishPhotoStory(...args,async()=>Response.json({allowed:true})),/could not be confirmed/);
 await assert.rejects(publishPhotoStory(...args,async()=>Response.json({allowed:true,story_expires_at:new Date(Date.now()+172800000).toISOString()})),/could not be confirmed/);
 await assert.rejects(publishPhotoStory(...args.slice(0,6),async()=>new Blob(["data"],{type:"video/mp4"}),async()=>{throw Error("must not send");}),/valid JPEG/);
 await assert.rejects(publishPhotoStory(...args,async()=>Response.json({allowed:false,message:"Disabled"},{status:403})),/Disabled/);
});
test("native Stories stay default off and are separated from ordinary posts",()=>{
 const feed=readFileSync(new URL("../app/feed.tsx",import.meta.url),"utf8"),ui=readFileSync(new URL("../components/PhotoStories.tsx",import.meta.url),"utf8"),helper=readFileSync(new URL("../src/native/photoStories.ts",import.meta.url),"utf8");
 assert.match(helper,/EXPO_PUBLIC_HOOPCHECK_PHOTO_STORIES_ENABLED === "true"/);
 assert.match(helper,/EXPO_PUBLIC_HOOPCHECK_COMMUNITY_PHOTO_STORIES_ENABLED==="true"/);
 assert.match(feed,/post.post_kind !== "story"/);assert.match(feed,/storyOwner===uid && focused && canRead && blocksVerified/);
 assert.match(ui,/storyVisible\(row,now\)/);assert.match(ui,/FeedReport/);assert.match(ui,/onBlock\(current.author_id\)/);
 assert.doesNotMatch(ui,/FeedSharePanel|AsyncStorage|localStorage/);
});

test("photo story media reference rejects arbitrary URLs, other owners, traversal and multiple attachments",()=>{
 assert.ok(resolveStoryPhoto(uid,photoRef,[photoRef]));
 assert.equal(resolveStoryPhoto(other,photoRef,[photoRef]),false);
 for(const invalid of ["https://example.test/a.jpg","hoopfeed-private-images/"+uid+"/../"+id(99)+".jpg",photoRef+".mp4"])assert.equal(resolveStoryPhoto(uid,invalid,[invalid]),false);
 assert.equal(resolveStoryPhoto(uid,photoRef,[photoRef,photoRef]),false);
});

test("Story multipart supports the validated React Native file descriptor and browser Blob",()=>{
 const photo={uri:"file:///private/photo.jpg",name:"photo.jpg",type:"image/jpeg",size:4,width:720,height:720};
 const parts=[];const nativeForm={append:(...args)=>parts.push(args)};
 const descriptor={uri:photo.uri,name:photo.name,type:photo.type};
 appendStoryPhoto(nativeForm,photo,descriptor);assert.deepEqual(parts,[["image",descriptor]]);
 for(const invalid of [{...descriptor,uri:"https://example.test/photo.jpg"},{...descriptor,uri:"file:///private/other.jpg"},{...descriptor,name:"other.jpg"},{...descriptor,type:"image/png"},new Blob(["bad"],{type:"image/jpeg"})])assert.throws(()=>appendStoryPhoto(nativeForm,photo,invalid),/valid JPEG/);
 const browser=new FormData();appendStoryPhoto(browser,photo,new Blob(["data"],{type:"image/jpeg"}));assert.equal(browser.get("image").size,4);
 const adapter=readFileSync(new URL("../src/native/mediaSelection.ts",import.meta.url),"utf8");assert.match(adapter,/!file\.exists \|\| file\.size !== photo\.size/);
});

test("explicit web community flag admits only approved private photo Stories and retains default follower scope",async()=>{
 const {db,calls}=fixture();const page=await readPhotoStories(db,uid,new AbortController().signal,undefined,now,true);
 assert.deepEqual(page.stories.map(x=>x.id),[id(0),id(2)]);
 assert.equal(calls[0].searchParams.has("community_visible"),false);
 assert.equal(page.stories[1].audience,"community");
 const photo={uri:"browser-file",name:"photo.jpg",type:"image/jpeg",size:4,width:720,height:720};
 const args=["https://api.test",uid,"token","Training",photo,new AbortController().signal,async()=>new Blob(["data"],{type:"image/jpeg"})];
 await assert.rejects(publishPhotoStory(...args,async()=>{throw Error("must not send");},"community",false),/audience unavailable/);
 const expiry=new Date(Date.now()+86400000).toISOString();
 assert.equal(await publishPhotoStory(...args,async(_,options)=>{
   assert.equal(options.body.get("audience"),"community");
   assert.equal(options.body.has("expires_at"),false);
   return Response.json({allowed:true,story_expires_at:expiry});
 },"community",true),expiry);
});
test("cancelled publication acknowledgement is not reported as success",async()=>{
 const photo={uri:"browser-file",name:"photo.jpg",type:"image/jpeg",size:4,width:720,height:720};
 const controller=new AbortController();
 await assert.rejects(publishPhotoStory("https://api.test",uid,"token","Training",photo,controller.signal,async()=>new Blob(["data"],{type:"image/jpeg"}),async()=>{
  controller.abort();return Response.json({allowed:true,story_expires_at:new Date(Date.now()+86400000).toISOString()});
 }),/could not be confirmed/);
});
test("web Stories are separately default off, scoped to the live account, and use protected media and server expiry",()=>{
 const web=readFileSync(new URL("../../../components/HoopFeedPhotoStories.tsx",import.meta.url),"utf8");
 const feed=readFileSync(new URL("../../../app/feed/page.tsx",import.meta.url),"utf8");
 assert.match(web,/NEXT_PUBLIC_HOOPCHECK_PHOTO_STORIES_ENABLED === "true"/);
 assert.match(web,/userId !== uid/);assert.match(web,/request.current\?\.abort\(\)/);
 assert.match(web,/storyVisible\(row,now\)/);assert.match(web,/HoopFeedPrivateMedia/);
 assert.match(web,/HoopFeedReportAction/);assert.match(web,/blockNativeAccount/);
 assert.match(web,/eq\("author_id",uid\).eq\("post_kind","story"\)/);
 assert.match(feed,/r.post_kind !== "story"/);assert.match(feed,/<HoopFeedPhotoStories key=\{user.id\} uid=\{user.id\}/);
 assert.doesNotMatch(web,/localStorage|sessionStorage|createSignedUrl/);
});

 test("sequential navigation skips expired Stories and never wraps or revives a missing selection",()=>{
 const live={...row(0),expires_at:"2026-11-28T10:00:00Z"};
 const expired={...row(1),expires_at:now.toISOString()};
 const next={...row(2),expires_at:"2026-11-28T10:00:00Z"};
 const rows=[live,expired,next];
 assert.equal(adjacentStoryId(rows,live.id,1,now.getTime()),next.id);
 assert.equal(adjacentStoryId(rows,next.id,-1,now.getTime()),live.id);
 assert.equal(adjacentStoryId(rows,live.id,-1,now.getTime()),null);
 assert.equal(adjacentStoryId(rows,next.id,1,now.getTime()),null);
 assert.equal(adjacentStoryId(rows,expired.id,1,now.getTime()),null);
 assert.equal(adjacentStoryId(rows,id(42),1,now.getTime()),null);
 assert.equal(adjacentStoryId(rows,live.id,1,Date.parse(live.expires_at)),null);
 });
 test("web and native expose guarded Story navigation and recheck session before dispatch",()=>{
 const web=readFileSync(new URL("../../../components/HoopFeedPhotoStories.tsx",import.meta.url),"utf8");
 const native=readFileSync(new URL("../components/PhotoStories.tsx",import.meta.url),"utf8");
 for(const ui of [web,native]){
  assert.match(ui,/Previous Story/);assert.match(ui,/Next Story/);
  assert.match(ui,/setSelected\(adjacentStoryId\(visible,current\.id,1\)\)/);
 }
 assert.match(web,/if\(live\.current&&request\.current===controller\)\{setRows\(\[\]\);setSelected\(null\);setCursor\(null\);\}/);
 assert.match(native,/currentSession\.data\.session\.access_token!==data\.session\.access_token/);
 });
