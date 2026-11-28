import {test} from "node:test";import assert from "node:assert/strict";
import {readMyVideoStoryJobs,readVideoStoryStatus,videoStoryPhaseLabel} from "../src/native/storyVideoReview.ts";
const id="11111111-1111-4111-8111-111111111111";
test("owner status accepts explicit processing phases only; approval is not publication",async()=>{
 const signal=new AbortController().signal;
 const request=async(url,options)=>{assert.equal(String(url),"https://fixture.test/api/hoopfeed/story-video-review");assert.equal(options.headers.Authorization,"Bearer token");assert.deepEqual(JSON.parse(options.body),{id,action:"status"});return Response.json({id,phase:"review_approved",published:false});};
 assert.equal(await readVideoStoryStatus("https://fixture.test","token",id,signal,request),"review_approved");
 assert.match(videoStoryPhaseLabel.review_approved,/not published/);
 for(const bad of [{id,phase:"approved",published:false},{id,phase:"review_approved",published:true},{id:"other",phase:"transcoding",published:false}])await assert.rejects(readVideoStoryStatus("https://fixture.test","token",id,signal,async()=>Response.json(bad)));
});

test("previous video jobs recover only validated status records, never publication or storage references",async()=>{
 const id="11111111-1111-4111-8111-111111111111",job={id,created_at:"2026-11-28T12:00:00Z",duration_ms:1000,phase:"awaiting_review",published:false},signal=new AbortController().signal;
 const request=async(url,init)=>{assert.equal(new URL(url).pathname,"/api/hoopfeed/story-video-review");assert.deepEqual(JSON.parse(init.body),{action:"my_jobs"});return Response.json({jobs:[job]});};
 assert.deepEqual(await readMyVideoStoryJobs("https://fixture.invalid","token",signal,request),[{id,created_at:job.created_at,duration_ms:1000,phase:"awaiting_review"}]);
 await assert.rejects(readMyVideoStoryJobs("https://fixture.invalid","token",signal,async()=>Response.json({jobs:[{...job,published:true}]})));
 await assert.rejects(readMyVideoStoryJobs("https://fixture.invalid","token",signal,async()=>Response.json({jobs:[job,job]})));
});
