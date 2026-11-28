import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {assuranceForVerifiedUser} from "../../../../lib/auth/mfa-core";
import {readJsonBody,RequestBodyError} from "../../../../lib/server/read-json-body";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const digest=/^[0-9a-f]{64}$/;
const phases=["awaiting_upload","inspecting","transcoding","awaiting_review","review_approved","rejected","retry_required"];
function reply(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});}
export async function POST(request:Request){
 if(process.env.HOOPCHECK_VIDEO_STORY_REVIEW_LIFECYCLE_ENABLED!=="true")return reply({error:"Video processing status unavailable"},503);
 try{
  const token=request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if(!token)return reply({error:"Sign in required"},401);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!pub||!key)return reply({error:"Unavailable"},503);
  const scoped=createClient(url,pub,{global:{headers:{Authorization:"Bearer "+token}},auth:{autoRefreshToken:false,persistSession:false}});
  const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error}=await scoped.auth.getUser(token);
  if(error||!user?.email_confirmed_at||assuranceForVerifiedUser(token,user).required)return reply({error:"Verify account"},403);
  const verify=async()=>{const r=await scoped.rpc("confirm_active_account_session");return !r.error&&r.data===true;};
  if(!await verify())return reply({error:"Verify account"},403);
  const raw=await readJsonBody(request,2048);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return reply({error:"Invalid request"},400);
  const b=raw as Record<string,unknown>;
  if(b.action==="my_jobs"){
   const r=await admin.rpc("story_video_owner_jobs",{p_owner:user.id});
   if(r.error||!Array.isArray(r.data?.jobs)||r.data.jobs.length>20||!await verify())return reply({error:"Status unavailable"},503);
   return reply(r.data);
  }
  if(b.action!=="queue"&&(typeof b.id!=="string"||!uuid.test(b.id)))return reply({error:"Invalid job"},400);
  if(b.action==="status"){
   const r=await admin.rpc("story_video_owner_status",{p_owner:user.id,p_job:b.id});
   if(r.error)return reply({error:"Status unavailable"},503);
   if(!r.data||r.data.id!==b.id||!phases.includes(r.data.phase)||r.data.published!==false||!await verify())return reply({error:"Job unavailable"},404);
   return reply({id:b.id,phase:r.data.phase,published:false});
  }
  if(process.env.HOOPCHECK_VIDEO_STORY_HUMAN_REVIEW_ENABLED!=="true")return reply({error:"Review unavailable"},503);
  const roles=await admin.from("admin_roles").select("role").eq("user_id",user.id);
  if(roles.error||!roles.data?.some(row=>["admin","moderator"].includes(String(row.role).trim().toLowerCase())))return reply({error:"Review unavailable"},403);
  if(b.action==="queue"){
   const r=await admin.rpc("story_video_review_queue",{p_actor:user.id});
   if(r.error||!Array.isArray(r.data?.jobs)||r.data.jobs.length>25||!await verify())return reply({error:"Review unavailable"},403);
   return reply(r.data);
  }
  if(b.action==="revoke"){
   if(typeof b.fence!=="string"||!uuid.test(b.fence)||b.attested!==true||!await verify())return reply({error:"Invalid revocation"},400);
   const r=await admin.rpc("revoke_story_video_review",{p_actor:user.id,p_job:b.id,p_fence:b.fence});
   if(r.error||r.data!==true)return reply({error:"Revocation unavailable"},409);
   return reply({id:b.id,revoked:true,published:false});
  }
  if(b.action==="asset"){
   const asset=await admin.rpc("story_video_review_asset",{p_actor:user.id,p_job:b.id});
   const a=asset.data;
   if(asset.error||!a||a.id!==b.id||typeof a.fence!=="string"||!uuid.test(a.fence)||!digest.test(a.video_sha256)||!digest.test(a.thumbnail_sha256)||typeof a.audio!=="boolean")return reply({error:"Review unavailable"},404);
   const prefix=/^story-processed\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/$/;
   const folder=typeof a.video_path==="string"&&a.video_path.endsWith("/video.mp4")?a.video_path.slice(0,-9):"";
   if(!prefix.test(folder)||!folder.endsWith("/"+b.id+"/"+a.fence+"/")||a.thumbnail_path!==folder+"thumbnail.jpg")return reply({error:"Review unavailable"},503);
   if(!await verify())return reply({error:"Verify account"},403);
   const bucket=await admin.storage.getBucket("hoopfeed-private-videos");
   if(bucket.error||bucket.data?.public!==false)return reply({error:"Review unavailable"},503);
   const [video,thumbnail]=await Promise.all([admin.storage.from("hoopfeed-private-videos").createSignedUrl(a.video_path,60),admin.storage.from("hoopfeed-private-videos").createSignedUrl(a.thumbnail_path,60)]);
   const after=await admin.rpc("story_video_review_asset",{p_actor:user.id,p_job:b.id});
   if(video.error||thumbnail.error||!video.data?.signedUrl||!thumbnail.data?.signedUrl||after.error||JSON.stringify(after.data)!==JSON.stringify(a)||!await verify())return reply({error:"Review unavailable"},503);
   return reply({id:b.id,fence:a.fence,video_sha256:a.video_sha256,thumbnail_sha256:a.thumbnail_sha256,audio:a.audio,video_url:video.data.signedUrl,thumbnail_url:thumbnail.data.signedUrl,expires_in:60});
  }
  if(b.action==="decision"){
   if(typeof b.fence!=="string"||!uuid.test(b.fence)||typeof b.video_sha256!=="string"||!digest.test(b.video_sha256)||typeof b.thumbnail_sha256!=="string"||!digest.test(b.thumbnail_sha256)||!["approved","rejected"].includes(String(b.visual))||!["approved","rejected","no_audio"].includes(String(b.audio))||b.attested!==true)return reply({error:"Explicit visual and audio review required"},400);
   if(!await verify())return reply({error:"Verify account"},403);
   const r=await admin.rpc("record_story_video_review",{p_actor:user.id,p_job:b.id,p_fence:b.fence,p_video_sha256:b.video_sha256,p_thumbnail_sha256:b.thumbnail_sha256,p_visual:b.visual,p_audio:b.audio});
   if(r.error||r.data!==true)return reply({error:"Review not confirmed; refresh the asset"},409);
   return reply({id:b.id,recorded:true,published:false});
  }
  return reply({error:"Invalid action"},400);
 }catch(error){return reply({error:"Request unavailable"},error instanceof RequestBodyError?error.status:503);}
}
