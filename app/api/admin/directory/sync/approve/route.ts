import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncNormalizedDirectory } from "../../../../../../lib/directory-sync/sync-directory";
import type { SyncEntityType, NormalizedDirectory } from "../../../../../../lib/directory-sync/types";

export async function POST(req:Request){
 const token=req.headers.get("authorization")?.replace(/^Bearer /,""); if(!token)return NextResponse.json({error:"Authentication required"},{status:401});
 const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:{user}}=await s.auth.getUser(token); if(!user)return NextResponse.json({error:"Invalid session"},{status:401});
 const {data:admin}=await s.rpc("is_current_user_admin_or_moderator"); if(!admin)return NextResponse.json({error:"Admin or moderator access required"},{status:403});
 const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!serviceRoleKey)return NextResponse.json({error:"Server directory sync is not configured"},{status:503});
 const adminSupabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
 const body=await req.json().catch(()=>({})); const previewId=typeof body.preview_id==="string"?body.preview_id:null; if(!previewId)return NextResponse.json({error:"preview_id is required"},{status:400});
 const {data:p,error}=await adminSupabase.from("directory_sync_previews").select("*").eq("id",previewId).single(); if(error||!p)return NextResponse.json({error:"Preview not found"},{status:404});
 if(p.status!=="pending")return NextResponse.json({error:`Preview is already ${p.status}`},{status:409});
 if(new Date(p.expires_at).getTime()<=Date.now()){await adminSupabase.from("directory_sync_previews").update({status:"expired"}).eq("id",previewId);return NextResponse.json({error:"Preview expired. Run a new preview."},{status:409});}
 const {data:run,error:runError}=await adminSupabase.from("directory_sync_runs").insert({source_id:p.source_id,entity_type:p.entity_type,status:"running",records_seen:0,records_created:0,records_updated:0,records_skipped:0}).select("id").single(); if(runError)return NextResponse.json({error:runError.message},{status:500});
 try{const result=await syncNormalizedDirectory(adminSupabase,p.source_id,p.entity_type as SyncEntityType,p.normalized_data as NormalizedDirectory);
  await adminSupabase.from("directory_sync_previews").update({status:"approved",approved_at:new Date().toISOString()}).eq("id",previewId);
  await adminSupabase.from("directory_sync_runs").update({status:"completed",records_seen:result.seen,records_created:result.created,records_updated:result.updated,records_skipped:result.skipped,finished_at:new Date().toISOString()}).eq("id",run.id);
  return NextResponse.json({preview_id:previewId,run_id:run.id,...result});
 }catch(e){const m=e instanceof Error?e.message:"Approval sync failed";await adminSupabase.from("directory_sync_runs").update({status:"failed",error_message:m,finished_at:new Date().toISOString()}).eq("id",run.id);return NextResponse.json({error:m,run_id:run.id},{status:500});}
}
