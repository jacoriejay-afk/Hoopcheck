// Offline-capable private transcode worker. No moderation or publication.
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdtemp,writeFile,readFile,stat,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
import {validateInspectionLease,fetchInspectionBytes,inspectVideoBytes} from "./run-story-video-inspection.mjs";
const exec=promisify(execFile),digest=b=>createHash("sha256").update(b).digest("hex"),MAX=50*1024*1024;
export function validateTranscodeLease(v){
 const j=validateInspectionLease(v),prefix="story-processed/"+j.owner_id+"/"+j.id+"/"+j.fence+"/";
 if(!/^[0-9a-f]{64}$/.test(j.source_digest)||!Number.isSafeInteger(j.duration_ms)||j.duration_ms<1||j.duration_ms>60000||typeof j.audio!=="boolean"||j.video_path!==prefix+"video.mp4"||j.thumbnail_path!==prefix+"thumbnail.jpg")throw Error("Invalid transcode lease.");
 return j;
}
export async function transcodeVideo(bytes,lease,{binary="ffmpeg"}={}){
 const j=validateTranscodeLease(lease);
 if(!Buffer.isBuffer(bytes)||bytes.length!==j.size_bytes||digest(bytes)!==j.source_digest)throw Error("Source digest changed.");
 const dir=await mkdtemp(join(tmpdir(),"hc-transcode-")),src=join(dir,"source"),video=join(dir,"video.mp4"),thumb=join(dir,"thumbnail.jpg");
 const format=j.content_type==="video/webm"?"matroska":"mov";
 const demux=format==="mov"?["-enable_drefs","0","-use_absolute_path","0"]:[];
 try{
  await writeFile(src,bytes,{mode:0o600});
  await exec(binary,["-nostdin","-v","error","-xerror","-protocol_whitelist","file,pipe","-f",format,...demux,"-threads","2","-i",src,"-map","0:v:0","-map","0:a:0?","-map_metadata","-1","-map_chapters","-1","-vf","scale=1280:1280:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,fps=30,setsar=1","-c:v","libx264","-preset","fast","-crf","24","-maxrate","4M","-bufsize","8M","-pix_fmt","yuv420p","-threads","2","-c:a","aac","-b:a","128k","-ac","2","-ar","48000","-movflags","+faststart","-t","60","-fs",String(MAX),video],{timeout:150000,maxBuffer:128*1024});
  if((await stat(video)).size>MAX)throw Error("Output too large.");
  const encoded=await readFile(video);
  const facts=await inspectVideoBytes(encoded,"video/mp4");
  // Permit normal frame/audio rounding, not material truncation or lost audio.
  if(Math.abs(facts.duration_ms-j.duration_ms)>250||facts.audio!==j.audio)throw Error("Transcode duration or audio changed.");
  await exec(binary,["-nostdin","-v","error","-xerror","-protocol_whitelist","file,pipe","-f","mov","-enable_drefs","0","-use_absolute_path","0","-i",video,"-map","0:v:0","-frames:v","1","-vf","scale=480:480:force_original_aspect_ratio=decrease:force_divisible_by=2","-map_metadata","-1","-q:v","3","-threads","1",thumb],{timeout:15000,maxBuffer:128*1024});
  if((await stat(thumb)).size>1048576)throw Error("Thumbnail too large.");
  const thumbnail=await readFile(thumb);
  if(thumbnail.length<4||thumbnail[0]!==255||thumbnail[1]!==216||thumbnail.at(-2)!==255||thumbnail.at(-1)!==217)throw Error("Invalid thumbnail.");
  return {encoded,thumbnail};
 }finally{await rm(dir,{recursive:true,force:true});}
}
export async function runStoryTranscode(client,download,store,transcode=transcodeVideo){
 const claim=await client.rpc("claim_story_video_transcode");
 if(claim.error)throw Error("Transcode claim unavailable.");
 if(["disabled","idle"].includes(claim.data?.state))return claim.data.state;
 const j=validateTranscodeLease(claim.data),bytes=await download(j);
 if(!Buffer.isBuffer(bytes)||bytes.length!==j.size_bytes||digest(bytes)!==j.source_digest)throw Error("Source digest changed.");
 const {encoded,thumbnail}=await transcode(bytes,j);
 if(!Buffer.isBuffer(encoded)||encoded.length<1||encoded.length>MAX||!Buffer.isBuffer(thumbnail)||thumbnail.length<4||thumbnail.length>1048576)throw Error("Invalid transcode output.");
 await store(j.video_path,encoded,"video/mp4");
 await store(j.thumbnail_path,thumbnail,"image/jpeg");
 const result={state:"ready",source_digest:j.source_digest,video_size:encoded.length,video_sha256:digest(encoded),thumbnail_size:thumbnail.length,thumbnail_sha256:digest(thumbnail)};
 const ack=await client.rpc("finish_story_video_transcode",{p_id:j.id,p_fence:j.fence,p_result:result});
 if(ack.error||ack.data!==true)throw Error("Transcode acknowledgement unavailable.");
 return "ready";
}
async function main(){
 if(process.env.HOOPCHECK_VIDEO_TRANSCODE_ENABLED!=="true"){console.log("story_transcode: disabled");return;}
 try{
  const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!origin||!key||origin!==process.env.HOOPCHECK_APPROVED_ISOLATED_MEDIA_PROJECT_URL)throw Error("Unapproved media project.");
  const {createClient}=await import("@supabase/supabase-js");
  const client=createClient(origin,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const bucket=await client.storage.getBucket("hoopfeed-private-videos");
  if(bucket.error||bucket.data?.public!==false)throw Error("Private storage unavailable.");
  const status=await runStoryTranscode(client,j=>fetchInspectionBytes(origin,key,j),async(path,bytes,type)=>{
   const r=await client.storage.from("hoopfeed-private-videos").upload(path,bytes,{contentType:type,upsert:false,cacheControl:"0"});
   if(r.error||r.data?.path!==path)throw Error("Private output upload unavailable.");
  });
  console.log("story_transcode: "+status);
 }catch{console.error("story_transcode: unavailable");process.exitCode=1;}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
