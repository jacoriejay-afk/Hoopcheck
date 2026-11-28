import {test} from "node:test";
import assert from "node:assert/strict";
import {validateStoryVideoInput,storyVideoPath,storyVideoMetadataMatches,uploadStoryDraft} from "../src/native/storyVideoStaging.ts";
const input={id:"33333333-3333-4333-8333-333333333333",content_type:"video/mp4",size:42,duration_ms:60000};
const owner="11111111-1111-4111-8111-111111111111";
test("private staging path is separated from publishable feed media",()=>{
 assert.equal(storyVideoPath(owner,input),"story-quarantine/"+owner+"/"+input.id+".mp4");
 for(const bad of [{...input,size:0},{...input,size:52428801},{...input,duration_ms:60001},{...input,content_type:"text/html"},{...input,id:"../bad"},{...input,approved:true}])assert.throws(()=>validateStoryVideoInput(bad));
 assert.throws(()=>storyVideoPath("../bad",input));
 assert.equal(storyVideoMetadataMatches({size:42,mimetype:"video/mp4"},input),true);
 assert.equal(storyVideoMetadataMatches({size:41,mimetype:"video/mp4"},input),false);
 assert.equal(storyVideoMetadataMatches({size:42,mimetype:"video/quicktime"},input),false);
});

test("private upload retries same job and never publishes a story",async()=>{
 let calls=0,uploads=0;
 const signal=new AbortController().signal,path=storyVideoPath(owner,input);
 const request=async(url,options)=>{
  assert.equal(String(url),"https://api.test/api/hoopfeed/story-video-upload");assert.equal(options.headers.Authorization,"Bearer token");assert.deepEqual(JSON.parse(options.body),input);
  return Response.json(++calls===1?{id:input.id,state:"awaiting_upload",bucket:"hoopfeed-private-videos",path,token:"signed"}:{id:input.id,state:"awaiting_moderation"});
 };
 const upload=async(url,headers)=>{uploads++;assert.equal(new URL(url).pathname,"/storage/v1/object/upload/sign/hoopfeed-private-videos/"+path);assert.equal(headers["x-upsert"],"false");return{status:200};};
 assert.equal(await uploadStoryDraft("https://api.test","https://storage.test",owner,"token",input,signal,upload,request),"awaiting_moderation");
 assert.equal(await uploadStoryDraft("https://api.test","https://storage.test",owner,"token",input,signal,upload,request),"awaiting_moderation");
 assert.equal(uploads,1);
 await assert.rejects(uploadStoryDraft("https://api.test","https://storage.test",owner,"token",input,signal,upload,async()=>Response.json({id:input.id,state:"awaiting_upload",bucket:"hoopfeed-private-videos",path:"other",token:"signed"})),/Invalid staging ticket/);
 assert.equal(uploads,1);
});

test("reconciles an uncertain transfer once, without sending the bytes again", async () => {
 const path=storyVideoPath(owner,input);
 for (const conflict of [false,true]) {
  let calls=0,uploads=0;
  const request=async()=>Response.json(++calls===1
    ? {id:input.id,state:"awaiting_upload",bucket:"hoopfeed-private-videos",path,token:"signed"}
    : {id:input.id,state:"awaiting_moderation"});
  const upload=async()=>{uploads++;if(conflict)return {status:409};throw Error("Connection dropped before receipt");};
  assert.equal(await uploadStoryDraft("https://api.test","https://storage.test",owner,"token",input,new AbortController().signal,upload,request), "awaiting_moderation");
  assert.equal(calls,2);
  assert.equal(uploads,1);
 }
});

test("cancellation stops confirmation and an incomplete transfer never reports staged", async () => {
 const path=storyVideoPath(owner,input);
 const ticket={id:input.id,state:"awaiting_upload",bucket:"hoopfeed-private-videos",path,token:"signed"};
 const controller=new AbortController();
 let calls=0;
 const request=async()=>{calls++;return Response.json(ticket);};
 const args=["https://api.test","https://storage.test",owner,"token",input];
 await assert.rejects(uploadStoryDraft(...args,controller.signal,async()=>{controller.abort();throw Error("Cancel");},request),/cancelled/);
 assert.equal(calls,1);
 await assert.rejects(uploadStoryDraft(...args,new AbortController().signal,async()=>({status:503}),request),/confirmation unavailable/);
 assert.equal(calls,3);
});
