import {test} from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {inspectVideoBytes,InvalidVideo,runStoryInspection,fetchInspectionBytes,validateVideoProbe} from "./run-story-video-inspection.mjs";
const id="11111111-1111-4111-8111-111111111111",owner="22222222-2222-4222-8222-222222222222",fence="33333333-3333-4333-8333-333333333333";
test("real ffmpeg-generated MP4 with audio is fully decoded and hash bound; corrupt bytes rejected",async()=>{
 const d=await mkdtemp(join(tmpdir(),"hc-video-fixture-"));
 try{
 const file=join(d,"fixture.mp4");
 execFileSync("ffmpeg",["-nostdin","-v","error","-f","lavfi","-i","color=c=black:s=160x90:r=10","-f","lavfi","-i","sine=frequency=440:sample_rate=44100","-t","1","-c:v","libx264","-threads","1","-pix_fmt","yuv420p","-c:a","aac",file],{timeout:15000});
 const bytes=await readFile(file),r=await inspectVideoBytes(bytes,"video/mp4");
 assert.equal(r.state,"verified");assert.equal(r.audio,true);assert.equal(r.width,160);assert.equal(r.height,90);assert.equal(r.duration_ms,1000);assert.match(r.sha256,/^[0-9a-f]{64}$/);
 await assert.rejects(inspectVideoBytes(Buffer.from("not video"),"video/mp4"),InvalidVideo);
 await assert.rejects(inspectVideoBytes(bytes,"video/webm"),InvalidVideo);
 }finally{await rm(d,{recursive:true,force:true});}
});
test("unsupported tracks, excessive dimensions, duration and frame rate fail closed",()=>{
 const stream={codec_type:"video",codec_name:"h264",width:160,height:90,avg_frame_rate:"30/1"};
 const data={streams:[stream],format:{format_name:"mov,mp4",size:"20",duration:"1"}};
 assert.equal(validateVideoProbe(data,"video/mp4",20).duration_ms,1000);
 for(const bad of [{...data,streams:[{...stream,width:3840}]},{...data,streams:[{...stream,avg_frame_rate:"120/1"}]},{...data,streams:[stream,{codec_type:"subtitle"}]},{...data,format:{...data.format,duration:"60.001"}}])assert.throws(()=>validateVideoProbe(bad,"video/mp4",20),InvalidVideo);
});
test("worker uses exact private path, bounded bytes, durable fence, and never calls publication",async()=>{
 const lease={state:"leased",id,owner_id:owner,object_path:"story-quarantine/"+owner+"/"+id+".mp4",content_type:"video/mp4",size_bytes:3,declared_duration_ms:1000,fence,object_id:id,version:"v1"};
 const req=async(url,options)=>{assert.equal(url.pathname,"/storage/v1/object/authenticated/hoopfeed-private-videos/"+lease.object_path);assert.equal(options.redirect,"error");return new Response("abc",{headers:{"content-type":"video/mp4"}});};
 assert.equal((await fetchInspectionBytes("https://fixture.invalid","token",lease,req)).toString(),"abc");
 await assert.rejects(fetchInspectionBytes("https://fixture.invalid","token",lease,async()=>new Response("abcd",{headers:{"content-type":"video/mp4"}})));
 const calls=[],client={async rpc(name,args){calls.push([name,args]);return name==="claim_story_video_inspection"?{data:lease}:{data:true};}};
 const result={state:"verified",sha256:"a".repeat(64),duration_ms:1000,width:160,height:90,audio:true};
 assert.equal(await runStoryInspection(client,async()=>Buffer.from("abc"),async()=>result),"verified");
 assert.deepEqual(calls,[["claim_story_video_inspection",undefined],["finish_story_video_inspection",{p_id:id,p_fence:fence,p_result:result}]]);
 await assert.rejects(runStoryInspection(client,async()=>Buffer.from("abc"),async()=>{throw Error("decoder missing");}),/decoder missing/);
 assert.equal(await runStoryInspection(client,async()=>Buffer.from("abc"),async()=>{throw new InvalidVideo();}),"rejected");
});
