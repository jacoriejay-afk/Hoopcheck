// Private technical inspection worker. Never publishes, approves moderation,
// deletes storage, or sends video to a third-party provider.
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
const exec=promisify(execFile);
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const kinds={"video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"};
const MAX=50*1024*1024;
export class InvalidVideo extends Error{}
const invalid=()=>new InvalidVideo("Unsupported or invalid video.");
export function validateInspectionLease(v){
 if(!v||v.state!=="leased"||![v.id,v.owner_id,v.fence,v.object_id].every(x=>typeof x==="string"&&uuid.test(x))||!Object.hasOwn(kinds,v.content_type)||v.object_path!=="story-quarantine/"+v.owner_id+"/"+v.id+"."+kinds[v.content_type]||!Number.isSafeInteger(v.size_bytes)||v.size_bytes<1||v.size_bytes>MAX||!Number.isSafeInteger(v.declared_duration_ms)||v.declared_duration_ms<1||v.declared_duration_ms>60000||typeof v.version!=="string"||!v.version||v.version.length>1024)throw Error("Invalid inspection lease.");
 return Object.freeze({...v});
}
export function validateVideoProbe(probe,contentType,size){
 const streams=probe?.streams,format=probe?.format;
 if(!Array.isArray(streams)||!format||!Object.hasOwn(kinds,contentType)||Number(format.size)!==size)throw invalid();
 const container=String(format.format_name??"").split(",");
 if(contentType==="video/webm"?!container.includes("webm"):!container.includes("mp4")&&!container.includes("mov"))throw invalid();
 const videos=streams.filter(s=>s.codec_type==="video"),audios=streams.filter(s=>s.codec_type==="audio");
 if(videos.length!==1||audios.length>1||streams.length!==videos.length+audios.length)throw invalid();
 const v=videos[0],audio=audios[0],allowed=contentType==="video/webm"?["vp8","vp9","av1"]:["h264","hevc","av1"];
 if(!allowed.includes(v.codec_name)||v.disposition?.attached_pic===1||!Number.isSafeInteger(v.width)||!Number.isSafeInteger(v.height)||Math.min(v.width,v.height)<1||Math.max(v.width,v.height)>1920||v.width*v.height>1920*1080)throw invalid();
 const ratio=String(v.avg_frame_rate??"").split("/").map(Number);
 const fps=ratio.length===2&&ratio[1]>0?ratio[0]/ratio[1]:NaN;
 const duration=Math.ceil(Number(format.duration)*1000);
 if(!Number.isFinite(fps)||fps<=0||fps>60||!Number.isSafeInteger(duration)||duration<1||duration>60000)throw invalid();
 if(audio&&(!["aac","opus","vorbis","mp3","alac","pcm_s16le"].includes(audio.codec_name)||!Number.isSafeInteger(audio.channels)||audio.channels<1||audio.channels>2||!Number.isFinite(Number(audio.sample_rate))||Number(audio.sample_rate)<8000||Number(audio.sample_rate)>48000))throw invalid();
 return {duration_ms:duration,width:v.width,height:v.height,audio:!!audio};
}
export async function inspectVideoBytes(bytes,contentType,{probeBinary="ffprobe",decodeBinary="ffmpeg"}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>MAX||!Object.hasOwn(kinds,contentType))throw invalid();
 // Restrict demuxers and protocols: no arbitrary playlist, network or nested
 // external inputs. Run the worker in an isolated non-root process/container.
 const inputFormat=contentType==="video/webm"?"matroska":"mov";
 const directory=await mkdtemp(join(tmpdir(),"hc-story-inspect-"));
 const input=join(directory,"source."+kinds[contentType]);
 try{
  await writeFile(input,bytes,{mode:0o600});
  let result;
  try{result=await exec(probeBinary,["-v","error","-protocol_whitelist","file,pipe","-f",inputFormat,"-i",input,"-show_streams","-show_format","-of","json"],{timeout:12000,maxBuffer:256*1024,windowsHide:true});}
  catch(e){if(e?.code==="ENOENT"||e?.killed||e?.signal)throw Error("Video inspector unavailable.");throw invalid();}
  let probe;try{probe=JSON.parse(result.stdout);}catch{throw invalid();}
  const facts=validateVideoProbe(probe,contentType,bytes.length);
  // Decode the complete bounded file, including every audio packet. Probe
  // metadata alone cannot detect all corrupt/truncated content.
  try{await exec(decodeBinary,["-nostdin","-v","error","-xerror","-protocol_whitelist","file,pipe","-f",inputFormat,"-threads","2","-i",input,"-map","0:v:0","-map","0:a:0?","-t","61","-f","null","-"],{timeout:90000,maxBuffer:128*1024,windowsHide:true});}
  catch(e){if(e?.code==="ENOENT"||e?.killed||e?.signal)throw Error("Video decoder unavailable.");throw invalid();}
  return {state:"verified",sha256:createHash("sha256").update(bytes).digest("hex"),...facts};
 }finally{await rm(directory,{recursive:true,force:true});}
}
export async function fetchInspectionBytes(origin,key,lease,request=fetch){
 const job=validateInspectionLease(lease),url=new URL(origin);
 if(url.protocol!=="https:"&&!(url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname))||url.username||url.password||url.pathname!=="/"||url.search||url.hash||typeof key!=="string"||!key||/\s/.test(key))throw Error("Invalid worker configuration.");
 url.pathname="/storage/v1/object/authenticated/hoopfeed-private-videos/"+job.object_path;
 const res=await request(url,{headers:{Authorization:"Bearer "+key,apikey:key,"Accept-Encoding":"identity"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(30000)});
 if(!res.ok||!res.body||res.headers.get("content-type")?.split(";")[0]!==job.content_type||res.headers.has("content-encoding")&&res.headers.get("content-encoding")!=="identity")throw Error("Private staged object unavailable.");
 const declared=res.headers.get("content-length");
 if(declared!==null&&Number(declared)!==job.size_bytes)throw Error("Staged byte length changed.");
 const reader=res.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>job.size_bytes||size>MAX){await reader.cancel();throw Error("Staged byte length changed.");}chunks.push(Buffer.from(value));}}
 finally{reader.releaseLock();}
 if(size!==job.size_bytes)throw Error("Staged byte length changed.");
 return Buffer.concat(chunks,size);
}
export async function runStoryInspection(client,download,inspect=inspectVideoBytes){
 const claim=await client.rpc("claim_story_video_inspection");
 if(claim.error)throw Error("Inspection claim unavailable.");
 if(["disabled","idle"].includes(claim.data?.state))return claim.data.state;
 const lease=validateInspectionLease(claim.data);
 const bytes=await download(lease);
 let result;
 try{result=await inspect(bytes,lease.content_type);}
 catch(e){if(!(e instanceof InvalidVideo))throw e;result={state:"rejected"};}
 const ack=await client.rpc("finish_story_video_inspection",{p_id:lease.id,p_fence:lease.fence,p_result:result});
 if(ack.error||ack.data!==true)throw Error("Inspection result not confirmed.");
 return result.state;
}
async function main(){
 if(process.env.HOOPCHECK_VIDEO_STORY_INSPECTION_ENABLED!=="true"){console.log("story_inspection: disabled");return;}
 try{
  const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!origin||!key||origin!==process.env.HOOPCHECK_APPROVED_ISOLATED_MEDIA_PROJECT_URL)throw Error("Unapproved worker project.");
  const {createClient}=await import("@supabase/supabase-js");
  const client=createClient(origin,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const status=await runStoryInspection(client,lease=>fetchInspectionBytes(origin,key,lease));
  console.log("story_inspection: "+status);
 }catch{console.error("story_inspection: unavailable");process.exitCode=1;}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
