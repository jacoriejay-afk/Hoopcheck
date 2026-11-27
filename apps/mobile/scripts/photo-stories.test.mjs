import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { readPhotoStories,publishPhotoStory,storyVisible } from "../src/native/photoStories.ts";
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
