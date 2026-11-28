import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getHoopCheckEntitlements } from "../../../../lib/membership-tier";
import { assuranceForVerifiedUser } from "../../../../lib/auth/mfa-core";
import { validateStoryVideoInput, storyVideoPath, storyVideoMetadataMatches } from "../../../../lib/story-video-staging";
import { readJsonBody, RequestBodyError } from "../../../../lib/server/read-json-body";

export const runtime = "nodejs";


export async function POST(request: Request) {
  if (process.env.HOOPCHECK_VIDEO_STORY_STAGING_ENABLED !== "true") return NextResponse.json({error:"Video Story staging unavailable"},{status:503});
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user?.email_confirmed_at) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  try {
    if (assuranceForVerifiedUser(token, user).required) return NextResponse.json({ error: "Verify your authenticator" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await admin.from("profiles").select("account_type,moderation_status").eq("id", user.id).maybeSingle();
  if (profileError || !profile || ["suspended", "banned", "removed"].includes(profile.moderation_status)) return NextResponse.json({ error: "Account profile unavailable" }, { status: 403 });
  const { data: subscription } = await admin.from("membership_entitlements").select("plan,status,access_status,current_period_end").eq("user_id", user.id).maybeSingle();
  const { data: adminRoles } = await admin.from("admin_roles").select("role").eq("user_id", user.id);
  const isAdmin = (adminRoles || []).some(row => String(row.role || "").toLowerCase() === "admin");
  const entitlements = getHoopCheckEntitlements({ accountType: profile.account_type, subscription, isAdmin });
  if (!entitlements.canWriteHoopFeed) return NextResponse.json({ error: "HoopFeed posting is unavailable" }, { status: 403 });

  let body: unknown;
  try { body = await readJsonBody(request, 1024); } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  let input;
  try {input=validateStoryVideoInput(body);}catch{return NextResponse.json({error:"Invalid video metadata"},{status:400});}
  const path=storyVideoPath(user.id,input);
  // Check the same caller's live session immediately before issuing a privileged upload token.
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  const scoped = createClient(url, publishableKey, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const active = await scoped.rpc("confirm_active_account_session");
  if (active.error || active.data !== true) return NextResponse.json({ error: "Account session unavailable" }, { status: 403 });
  const headers={"Cache-Control":"no-store"};
  const bucket="hoopfeed-private-videos";
  const bucketInfo=await admin.storage.getBucket(bucket);
  if(bucketInfo.error||bucketInfo.data?.public!==false)return NextResponse.json({error:"Private staging unavailable"},{status:503,headers});
  const expected={id:input.id,owner_id:user.id,object_path:path,content_type:input.content_type,size_bytes:input.size,declared_duration_ms:input.duration_ms};
  const reserved=await admin.from("hoop_story_video_jobs").upsert(expected,{onConflict:"id",ignoreDuplicates:true});
  if(reserved.error)return NextResponse.json({error:"Staging unavailable"},{status:503,headers});
  const job=await admin.from("hoop_story_video_jobs").select("id,owner_id,object_path,content_type,size_bytes,declared_duration_ms,state").eq("id",input.id).eq("owner_id",user.id).maybeSingle();
  if(job.error||!job.data||Object.entries(expected).some(([key,value])=>(job.data as unknown as Record<string,unknown>)[key]!==value))return NextResponse.json({error:"Staging request unavailable"},{status:409,headers});
  if(!["awaiting_upload","awaiting_moderation"].includes(job.data.state))return NextResponse.json({error:"Staging unavailable"},{status:503,headers});
  const folder=path.slice(0,path.lastIndexOf("/")),filename=path.slice(path.lastIndexOf("/")+1);
  const objects=await admin.storage.from(bucket).list(folder,{search:filename,limit:2});
  if(objects.error||!Array.isArray(objects.data))return NextResponse.json({error:"Staging unavailable"},{status:503,headers});
  const object=objects.data.find(row=>row.name===filename);
  const stillActive=await scoped.rpc("confirm_active_account_session");
  if(stillActive.error||stillActive.data!==true)return NextResponse.json({error:"Account session unavailable"},{status:403,headers});
  if(object){
    if(!storyVideoMetadataMatches(object.metadata,input))return NextResponse.json({error:"Staged file metadata mismatch"},{status:409,headers});
    if(job.data.state==="awaiting_upload"){
      const updated=await admin.from("hoop_story_video_jobs").update({state:"awaiting_moderation",uploaded_at:new Date().toISOString()}).eq("id",input.id).eq("owner_id",user.id).eq("state","awaiting_upload").select("id").maybeSingle();
      if(updated.error||updated.data?.id!==input.id)return NextResponse.json({error:"Staging confirmation unavailable; retry the same request"},{status:409,headers});
    }
    // The file's actual duration, format, frames and audio are NOT yet verified.
    // This status only acknowledges private bytes awaiting moderation.
    return NextResponse.json({id:input.id,state:"awaiting_moderation"},{headers});
  }
  if(job.data.state!=="awaiting_upload")return NextResponse.json({error:"Staged object unavailable"},{status:409,headers});
  const ticket=await admin.storage.from(bucket).createSignedUploadUrl(path,{upsert:false});
  if(ticket.error||!ticket.data?.token)return NextResponse.json({error:"Upload unavailable"},{status:503,headers});
  return NextResponse.json({id:input.id,state:"awaiting_upload",path,token:ticket.data.token,bucket},{headers});
}
