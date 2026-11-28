import {test} from "node:test";import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";import {mkdtemp,readFile,rm} from "node:fs/promises";import {tmpdir} from "node:os";import {join} from "node:path";import {createHash} from "node:crypto";
import {transcodeVideo,runStoryTranscode} from "./run-story-video-transcode.mjs";
const id="11111111-1111-4111-8111-111111111111",owner="22222222-2222-4222-8222-222222222222",fence="33333333-3333-4333-8333-333333333333";
const hash=b=>createHash("sha256").update(b).digest("hex");
function lease(bytes){const prefix="story-processed/"+owner+"/"+id+"/"+fence+"/";return {state:"leased",id,owner_id:owner,fence,object_id:id,version:"v1",object_path:"story-quarantine/"+owner+"/"+id+".mp4",content_type:"video/mp4",size_bytes:bytes.length,declared_duration_ms:1000,duration_ms:1000,audio:true,source_digest:hash(bytes),video_path:prefix+"video.mp4",thumbnail_path:prefix+"thumbnail.jpg"};}
test("real local H264/AAC faststart transcode and JPEG thumbnail; digest mismatch fails",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"hc-transcode-test-"));
 try{
 const src=join(dir,"source.mp4");execFileSync("ffmpeg",["-nostdin","-v","error","-f","lavfi","-i","color=c=blue:s=160x90:r=10","-f","lavfi","-i","sine=frequency=440:sample_rate=44100","-t","1","-c:v","libx264","-threads","1","-pix_fmt","yuv420p","-c:a","aac",src],{timeout:15000});
 const bytes=await readFile(src),j=lease(bytes),out=await transcodeVideo(bytes,j);
 assert.ok(out.encoded.indexOf("moov")<out.encoded.indexOf("mdat"));assert.equal(out.thumbnail[0],255);assert.equal(out.thumbnail[1],216);
 await assert.rejects(transcodeVideo(bytes,{...j,source_digest:"a".repeat(64)}),/digest changed/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test("fenced worker never publishes or approves, requires both uploads and matching receipt",async()=>{
 const bytes=Buffer.from("abc"),j=lease(bytes),calls=[],stored=[];
 const client={async rpc(n,a){calls.push([n,a]);return {data:n==="claim_story_video_transcode"?j:true};}};
 const output={encoded:Buffer.from("video"),thumbnail:Buffer.from([255,216,255,217])};
 assert.equal(await runStoryTranscode(client,async()=>bytes,async(...a)=>stored.push(a),async()=>output),"ready");
 assert.deepEqual(stored.map(a=>a[0]),[j.video_path,j.thumbnail_path]);assert.equal(calls[1][0],"finish_story_video_transcode");assert.equal(calls[1][1].p_result.video_sha256,hash(output.encoded));
 calls.length=0;await assert.rejects(runStoryTranscode(client,async()=>bytes,async()=>{throw Error("upload failed")},async()=>output));assert.equal(calls.length,1);
 calls.length=0;await assert.rejects(runStoryTranscode(client,async()=>Buffer.from("bad"),async()=>{},async()=>output));assert.equal(calls.length,1);
});
