import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { act, create } from "react-test-renderer";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
function compile(source, stubs={}) {
  const result = ts.transpileModule(source, { compilerOptions:{ module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX, target:ts.ScriptTarget.ES2022 }, reportDiagnostics:true });
  assert.equal(result.diagnostics?.length || 0, 0);
  const exports = {};
  vm.runInNewContext(result.outputText, { exports, require: name=>stubs[name] || require(name), URL, Date, Set, Map, Promise, setTimeout, clearTimeout });
  return exports;
}
const sourceApi = compile(read("../../../lib/hoopreels/video-source.ts"));
const owner = "11111111-1111-4111-8111-111111111111";
const postId = "22222222-2222-4222-8222-222222222222";
const author = "33333333-3333-4333-8333-333333333333";
const other = "44444444-4444-4444-8444-444444444444";
// Synthetic shape only. Never a real signed token, provider upload, or production seed.
const fixture = () => ({
  provider:"mux", postId, playbackId:"fixtureVideoId",
  hlsUrl:"https://stream.mux.com/fixtureVideoId.m3u8?token=aaa.bbb.ccc",
  posterUrl:"https://image.mux.com/fixtureVideoId/thumbnail.jpg?token=aaa.bbb.ccc",
  duration:45,width:1080,height:1920,expiresAt:Date.now()+600000,
});
test("provider-only resolver refuses unsigned, expired, raw, mismatched, oversize or non-HLS assets",()=>{
  const valid=fixture();
  assert.equal(sourceApi.HOOPREELS_CREATE_ENABLED,false);
  assert.equal(sourceApi.resolveVideoSource(valid).playbackId,valid.playbackId);
  for(const patch of [
    {provider:"supabase"},{hlsUrl:"https://fixture.supabase.co/storage/v1/object/sign/reels/video.mp4?token=aaa.bbb.ccc"},
    {hlsUrl:"https://stream.mux.com.evil.test/fixtureVideoId.m3u8?token=aaa.bbb.ccc"},
    {hlsUrl:"https://stream.mux.com/fixtureVideoId.mp4?token=aaa.bbb.ccc"},
    {hlsUrl:"https://stream.mux.com/fixtureVideoId.m3u8"},{posterUrl:"https://image.mux.com/wrongId/thumbnail.jpg?token=aaa.bbb.ccc"},
    {duration:61},{width:2160,height:3840},{expiresAt:Date.now()-1000},{postId:"not-a-uuid"}
  ]) assert.equal(sourceApi.resolveVideoSource({...valid,...patch}),null,JSON.stringify(patch));
  assert.equal(sourceApi.curatedReelCatalog(undefined,undefined).configured,false);
  assert.equal(sourceApi.curatedReelCatalog("mux",JSON.stringify([valid,valid])).configured,false);
  assert.equal(sourceApi.curatedReelCatalog("mux",JSON.stringify([valid])).assets.length,1);
});
test("For You ranks real recency, normalized Checks and followed anchors; Following matches user/team/league",()=>{
  const now=Date.now(), fresh={id:postId,author_id:author,created_at:new Date(now-3600000).toISOString()};
  const stale={id:other,author_id:other,club_id:owner,created_at:new Date(now-7*86400000).toISOString()};
  assert.equal(sourceApi.rankReels([stale,fresh],{},new Set(),now)[0].id,postId);
  assert.equal(sourceApi.isFollowedReel(stale,new Set([owner])),true);
  assert.equal(sourceApi.isFollowedReel(fresh,new Set([author])),true);
  assert.equal(sourceApi.isFollowedReel(fresh,new Set([owner])),false);
  const strong={...stale,created_at:new Date(now-2*3600000).toISOString()};
  assert.equal(sourceApi.rankReels([fresh,strong],{[other]:20},new Set([owner]),now)[0].id,other);
});
test("catalog client uses bearer auth, no raw fallback, and verifies curated post identity",async()=>{
  const api=compile(read("../src/native/reelCatalog.ts"),{"../../../../lib/hoopreels/video-source":sourceApi});
  const signal=new AbortController().signal;
  let requestCount=0;
  const result=await api.requestReelCatalog("https://api.test","fixture-token",signal,async(url,opts)=>{
    requestCount++;assert.equal(url,"https://api.test/api/hoopreels/catalog");
    assert.equal(opts.headers.Authorization,"Bearer fixture-token");assert.equal(opts.cache,"no-store");
    return Response.json({configured:false,posts:[{id:postId,video_url:"raw.mp4"}]});
  });
  assert.equal(result.configured,false);assert.equal(result.posts.length,0);assert.equal(requestCount,1);
  const post={id:postId,author_id:author,created_at:new Date().toISOString(),reel_source:fixture(),video_url:"raw.mp4"};
  const good=await api.requestReelCatalog("https://api.test","fixture-token",signal,async()=>Response.json({configured:true,posts:[post,{...post,id:other}]}));
  assert.equal(good.posts.length,1);assert.equal(good.posts[0].video_url,null);
  await assert.rejects(api.requestReelCatalog("https://api.test","fixture-token",signal,async()=>Response.json({}, {status:503})),/streaming is unavailable/);
});
test("Reel card uses only the provider source and pauses neighbours; double tap wins over mute and never unchecks",async()=>{
  const stubs={
    "@expo/vector-icons":{Ionicons:"Ionicons"},
    "expo-linear-gradient":{LinearGradient:"LinearGradient"},
    "react-native":{Pressable:"Pressable",Text:"Text",View:"View",StyleSheet:{absoluteFill:{}}},
    "react-native-reanimated":{__esModule:true,default:{View:"AnimatedView"},
      useSharedValue(value){return React.useRef({value,get(){return this.value},set(next){this.value=next}}).current;},
      useAnimatedStyle(fn){return fn();},cancelAnimation(){},Easing:{linear:x=>x},
      withTiming(v){return v},withSequence(...v){return v.at(-1)},withRepeat(v){return v}},
    "../src/motion/Provider":{useMotionSetting:()=>true},
    "./ProfileAvatar":{ProfileAvatar:"ProfileAvatar"},
    "./ReelStreamVideo":{ReelStreamVideo:"ReelStreamVideo"},
  };
  const Card=compile(read("../components/HoopReelCard.tsx"),stubs).HoopReelCard;
  const events=[];
  const post={id:postId,author_id:author,body:"Synthetic test only",video_url:"raw.mp4",reel_source:fixture(),
    reel_team:{id:other,name:"Fixture club",women:false},profiles:{display_name:"Fixture creator",username:"fixture",account_type:"player"}};
  const props={post,userId:owner,height:620,active:true,ready:true,canWrite:true,muted:true,pulseKey:0,
    check:{mine:false,count:2},saved:false,checkBusy:false,saveBusy:false,blockBusy:false,
    onBack(){},onCreate(){},onViewPlayer(){},onMute(){events.push("mute")},onCheck(){events.push("check")},
    onTeam(){events.push("team")},onComments(){events.push("comment")},onSound(){events.push("sound")},
    onShare(){},onSave(){},onReport(){events.push("report")},onHide(){},onHideCreator(){},onBlockCreator(){events.push("block")}};
  let tree;
  await act(async()=>{tree=create(React.createElement(Card,props))});
  const player=()=>tree.root.findByType("ReelStreamVideo").props;
  const button=label=>tree.root.findAllByType("Pressable").find(x=>x.props.accessibilityLabel===label);
  assert.equal(player().source.provider,"mux");assert.equal(player().active,true);
  const tap=()=>button("Unmute Reel with one tap, Check with two taps").props.onPress();
  await act(async()=>{tap();tap()});assert.deepEqual(events,["check"]);
  await act(async()=>{tap();await new Promise(resolve=>setTimeout(resolve,275))});assert.deepEqual(events,["check","mute"]);
  await act(async()=>{button("Fixture club — See the reviews").props.onPress();button("Comments").props.onPress()});
  assert.deepEqual(events,["check","mute","team","comment"]);
  await act(async()=>button("Reel options").props.onPress());assert.equal(player().active,false);
  await act(async()=>button("Block account").props.onPress());assert.equal(events.at(-1),"block");
  await act(async()=>tree.update(React.createElement(Card,{...props,check:{mine:true,count:3}})));
  await act(async()=>{tap();tap()});assert.equal(events.filter(e=>e==="check").length,1);
  await act(async()=>tree.update(React.createElement(Card,{...props,active:false})));assert.equal(player().active,false);
  await act(async()=>tree.update(React.createElement(Card,{...props,ready:false})));assert.equal(tree.root.findAllByType("ReelStreamVideo").length,0);
  await act(async()=>tree.update(React.createElement(Card,{...props,post:{...post,reel_source:undefined}})));assert.equal(tree.root.findAllByType("ReelStreamVideo").length,0);
  await act(async()=>tree.unmount());
});
test("watch preserves membership, block RLS, moderation, and shared comments without raw playback",()=>{
  const feed=read("../app/feed.tsx"), card=read("../components/HoopReelCard.tsx"), stream=read("../components/ReelStreamVideo.tsx");
  const route=read("../../../app/api/hoopreels/catalog/route.ts"), studio=read("../app/reels/studio.tsx");
  assert.match(feed,/account\?\.features\.canReadHoopFeed/);
  assert.match(feed,/blockedCreators\.owner === uid && blockedCreators\.ready && !blockedCreators\.failed/);
  assert.match(feed,/onReport=\{\(\) => void action/);assert.match(feed,/onBlockCreator=\{\(\) => void blockAccount/);
  assert.match(feed,/requestReelCatalog\(origin/);assert.match(feed,/index <= firstPreloadIndex \+ 2/);
  assert.match(feed,/<Sheet open/);assert.match(feed,/renderComments\(post\)/);
  assert.match(feed,/hoopcheck:reels:muted:v1:/);
  assert.doesNotMatch(card,/<FeedMedia/);assert.match(stream,/contentType: "hls"/);
  assert.match(route,/await bootstrap\(request\)/);assert.match(route,/entitlements\?\.canReadHoopFeed/);
  assert.match(route,/HOOPREELS_ADMIN_HLS_CATALOG/);assert.match(route,/eq\("status", "approved"\)/);
  assert.match(studio,/HOOPREELS_CREATE_ENABLED \? <HoopReelsStudio \/> : <CreationPaused \/>/);
});
