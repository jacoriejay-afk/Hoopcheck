import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const transitions: Record<string,string[]> = {
  research_required:["research_complete"], research_complete:["license_requested"],
  license_requested:["license_verified","rejected"], license_verified:["commercial_approved","rejected"],
  commercial_approved:["redistribution_approved","rejected"], redistribution_approved:["production_approved","rejected"],
  rejected:["research_required"], expired:["research_required"],
};

export async function POST(req:Request){
  const token=req.headers.get("authorization")?.replace(/^Bearer /,"");
  if(!token)return NextResponse.json({error:"Authentication required"},{status:401});
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:{user}}=await client.auth.getUser(token); if(!user)return NextResponse.json({error:"Invalid session"},{status:401});
  const {data:isAdmin}=await client.rpc("is_current_user_admin_or_moderator"); if(!isAdmin)return NextResponse.json({error:"Admin or moderator access required"},{status:403});
  const body=await req.json().catch(()=>({})); const id=typeof body.id==="string"?body.id:null; const toStatus=typeof body.to_status==="string"?body.to_status:null; const note=typeof body.note==="string"?body.note.trim():null;
  if(!id||!toStatus)return NextResponse.json({error:"id and to_status are required"},{status:400});
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY; if(!key)return NextResponse.json({error:"Server configuration missing"},{status:503});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:row,error:readError}=await db.from("rights_registry").select("*").eq("id",id).single(); if(readError||!row)return NextResponse.json({error:"Rights record not found"},{status:404});
  if(!(transitions[row.workflow_status]||[]).includes(toStatus))return NextResponse.json({error:`Invalid transition from ${row.workflow_status} to ${toStatus}`},{status:409});
  if(toStatus==="license_verified" && !row.evidence_url?.trim())return NextResponse.json({error:"License verification requires evidence_url."},{status:409});
  if(toStatus==="commercial_approved" && row.commercial_use_allowed!==true)return NextResponse.json({error:"Commercial approval requires commercial_use_allowed=true."},{status:409});
  if(toStatus==="redistribution_approved" && (row.commercial_use_allowed!==true||row.redistribution_allowed!==true))return NextResponse.json({error:"Redistribution approval requires commercial and redistribution rights."},{status:409});
  if(toStatus==="production_approved" && (row.commercial_use_allowed!==true||row.redistribution_allowed!==true||!row.evidence_url?.trim()))return NextResponse.json({error:"Production approval requires commercial use, redistribution, and evidence."},{status:409});
  const now=new Date().toISOString(); const patch:any={workflow_status:toStatus,workflow_note:note||row.workflow_note,approved_by:user.id,updated_at:now};
  if(toStatus==="license_requested")patch.license_requested_at=now;
  if(toStatus==="license_verified")patch.license_verified_at=now;
  if(toStatus==="commercial_approved")patch.commercial_approved_at=now;
  if(toStatus==="redistribution_approved")patch.redistribution_approved_at=now;
  if(toStatus==="production_approved"){patch.production_approved_at=now;patch.production_approved=true;} else patch.production_approved=false;
  const {error:updateError}=await db.from("rights_registry").update(patch).eq("id",id); if(updateError)return NextResponse.json({error:updateError.message},{status:500});
  const {error:eventError}=await db.from("rights_registry_events").insert({rights_registry_id:id,actor_id:user.id,from_status:row.workflow_status,to_status:toStatus,note}); if(eventError)return NextResponse.json({error:eventError.message},{status:500});
  return NextResponse.json({ok:true,status:toStatus});
}