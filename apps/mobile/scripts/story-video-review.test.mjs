import {test} from "node:test";import assert from "node:assert/strict";
import {readVideoStoryStatus,videoStoryPhaseLabel} from "../src/native/storyVideoReview.ts";
const id="11111111-1111-4111-8111-111111111111";
test("owner status accepts explicit processing phases only; approval is not publication",async()=>{
 const signal=new AbortController().signal;
 const request=async(url,options)=>{assert.equal(String(url),"https://fixture.test/api/hoopfeed/story-video-review");assert.equal(options.headers.Authorization,"Bearer token");assert.deepEqual(JSON.parse(options.body),{id,action:"status"});return Response.json({id,phase:"review_approved",published:false});};
 assert.equal(await readVideoStoryStatus("https://fixture.test","token",id,signal,request),"review_approved");
 assert.match(videoStoryPhaseLabel.review_approved,/not published/);
 for(const bad of [{id,phase:"approved",published:false},{id,phase:"review_approved",published:true},{id:"other",phase:"transcoding",published:false}])await assert.rejects(readVideoStoryStatus("https://fixture.test","token",id,signal,async()=>Response.json(bad)));
});
