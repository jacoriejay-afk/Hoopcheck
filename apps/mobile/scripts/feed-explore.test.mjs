import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesFeedExplore, exploreFilters, cleanExploreSearch } from "../src/native/feedExplore.ts";
const post = {body:"Overseas basketball #training",post_kind:"discussion",profiles:{display_name:"Fixture Creator"},image_url:null,image_urls:null,video_url:null};
test("Explore searches loaded text and creator names, not private metadata",()=>{
  assert.deepEqual(exploreFilters,["all","discussion","media","polls"]);
  assert.equal(matchesFeedExplore(post,"all","  BASKETBALL creator  "),true);
  assert.equal(matchesFeedExplore(post,"all","#training"),true);
  assert.equal(matchesFeedExplore({...post,author_id:"private-id",post_location:"private-location"},"all","private"),false);
  assert.equal(matchesFeedExplore(post,"all","missing"),false);
  assert.equal(matchesFeedExplore({...post,body:null,profiles:null},"all",""),true);
});
test("Explore media and poll filters do not invent content",()=>{
  assert.equal(matchesFeedExplore(post,"discussion",""),true);
  assert.equal(matchesFeedExplore(post,"media",""),false);
  assert.equal(matchesFeedExplore({...post,image_urls:["image"]},"media",""),true);
  assert.equal(matchesFeedExplore({...post,video_url:"video"},"discussion",""),false);
  assert.equal(matchesFeedExplore({...post,post_kind:"poll"},"polls",""),true);
  assert.equal(matchesFeedExplore(post,"polls",""),false);
});
test("Explore is downstream of existing account, expiry, block and saved gates",()=>{
  const feed=readFileSync(new URL("../app/feed.tsx",import.meta.url),"utf8");
  assert.match(feed,/const posts = canRead && blocksVerified && rows\.scope === scope \? rows\.posts\.filter/);
  assert.match(feed,/!blockedCreators\.ids\.includes\(post\.author_id\)/);
  assert.match(feed,/const displayPosts = exploring \? posts\.filter/);
  assert.match(feed,/data=\{displayPosts\}/);
  assert.match(feed,/const exploring = !reels && !savedOnly && explore\.owner === uid/);
  assert.match(feed,/\["all","saved","explore"\]/);
  assert.match(feed,/ListHeaderComponent=\{!reels && !savedOnly && !exploring/);
});

test("server Explore sanitizes terms and distinguishes public post text from creator names",()=>{
 assert.equal(cleanExploreSearch("  İstanbul #hoops (a),x.eq.*%_  "),"İstanbul #hoops a x eq");
 assert.equal(cleanExploreSearch("a".repeat(120)).length,100);
 assert.equal(matchesFeedExplore(post,"all","creator","posts"),false);
 assert.equal(matchesFeedExplore(post,"all","creator","creators"),true);
 assert.equal(matchesFeedExplore(post,"all","training","creators"),false);
});
test("server Explore uses the existing RLS-visible projection and fixed session",()=>{
 const source=readFileSync(new URL("../src/native/feedClient.ts",import.meta.url),"utf8");
 const explore=source.slice(source.indexOf("export async function readExploreFeedPage"),source.indexOf("/** Saved library cursor"));
 assert.match(explore,/readablePosts\(client, now,/);
 assert.match(explore,/\.ilike\(target === "creators" \? "profiles.display_name" : "body"/);
 assert.match(explore,/\.eq\("user_id",userId\)/);
 assert.match(explore,/\.eq\("blocker_id",userId\)/);
 assert.match(explore,/current.data.session.access_token !== token/);
 assert.match(explore,/\.setHeader\("Authorization",header\)/);
 assert.doesNotMatch(explore,/service_role|fetch\(/);
 const feed=readFileSync(new URL("../app/feed.tsx",import.meta.url),"utf8");
 assert.match(feed,/exploring \? readExploreFeedPage/);
 assert.match(feed,/JSON.stringify\(\[uid \?\? "",reels,savedOnly,exploring,exploreSearch,exploreFilter,exploreTarget\]\)/);
});

import { createClient } from "@supabase/supabase-js";
import { readExploreFeedPage } from "../src/native/feedClient.ts";
const viewer="11111111-1111-4111-8111-111111111111";
const other="33333333-3333-4333-8333-333333333333";
const postId=n=>"22222222-2222-4222-8222-"+String(n).padStart(12,"0");
const now=new Date("2026-11-27T12:00:00Z");
function fixture({change=false,deny=false}={}){
 const calls=[];let sessions=0;
 const db=createClient("https://fixture.supabase.co","fixture-key",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,options)=>{
  const url=new URL(String(input));calls.push({url,options});
  if(url.pathname.endsWith("/feed_posts"))return Response.json(Array.from({length:21},(_,i)=>({...post,id:postId(i),author_id:i===1?other:viewer,created_at:"2026-11-26T12:00:00Z",expires_at:i===2?"2026-11-27T11:00:00Z":null})));
  if(url.pathname.endsWith("/feed_post_archives"))return deny?Response.json({message:"denied"},{status:403}):Response.json([{post_id:postId(0)}]);
  if(url.pathname.endsWith("/user_blocks"))return Response.json([{blocked_id:other}]);
  throw Error("Unexpected endpoint");
 }}});
 db.auth.getSession=async()=>({error:null,data:{session:{access_token:change&&sessions++>0?"new-token":"fixture-token",user:{id:viewer}}}});
 return {db,calls};
}
test("server Explore queries text and creator matches before paging, and hides archives, blocks and expiry",async()=>{
 for(const target of ["posts","creators"]){
  const {db,calls}=fixture();
  const page=await readExploreFeedPage(db,viewer,"all",target==="posts"?"basketball":"creator",target,undefined,now);
  assert.equal(page.posts.length,17);
  assert.equal(page.next.id,postId(19));
  const params=calls[0].url.searchParams;
  assert.equal(params.get("status"),"eq.approved");
  assert.equal(params.get("limit"),"21");
  assert.equal(params.get(target==="posts"?"body":"profiles.display_name"),target==="posts"?"ilike.%basketball%":"ilike.%creator%");
  assert.equal(params.get("select").includes("!inner"),target==="creators");
  assert.equal(calls.find(c=>c.url.pathname.endsWith("/feed_post_archives")).url.searchParams.get("user_id"),"eq."+viewer);
  assert.equal(calls.find(c=>c.url.pathname.endsWith("/user_blocks")).url.searchParams.get("blocker_id"),"eq."+viewer);
 }
});
test("server Explore rejects wrong session and failed access verification",async()=>{
 await assert.rejects(readExploreFeedPage(fixture({change:true}).db,viewer,"all","basketball","posts",undefined,now),/Account changed/);
 await assert.rejects(readExploreFeedPage(fixture({deny:true}).db,viewer,"all","basketball","posts",undefined,now),/access could not be verified/);
 const {db,calls}=fixture();
 await assert.rejects(readExploreFeedPage(db,other,"all","","posts",undefined,now),/Sign in again/);
 assert.equal(calls.length,0);
});
