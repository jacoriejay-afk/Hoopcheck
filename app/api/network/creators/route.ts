import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Explicit public creator projection. No creator draft or private parent profile
 * is ever returned, even when a previously published profile becomes private.
 * Do not use this service-client path for general profile reads.
 */
export async function GET(request:Request) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({error:"Creator network is not configured."},{status:503});
  const id=new URL(request.url).searchParams.get("id");
  if(id&&!uuid.test(id))return NextResponse.json({error:"Invalid creator profile."},{status:400});
  try{
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    let query=db.from("creator_profiles").select(
      "profile_id,category,headline,description,website_url,profiles!inner(id,display_name,username,avatar_url,avatar_moderation_status,country,profile_visibility,moderation_status)"
    ).eq("is_published",true)
     .eq("profiles.profile_visibility","public").eq("profiles.moderation_status","normal");
    if(id)query=query.eq("profile_id",id);
    const {data,error}=await query.order("created_at",{ascending:false}).limit(id?1:200);
    if(error)throw error;
    const safe=(data||[]).flatMap(item=>{
      const p=Array.isArray(item.profiles)?item.profiles[0]:item.profiles;
      if(!p||p.profile_visibility!=="public"||p.moderation_status!=="normal")return [];
      return [{profile_id:item.profile_id,category:item.category,headline:item.headline,
        description:item.description,website_url:item.website_url,
        profiles:{id:p.id,display_name:p.display_name,username:p.username,
          avatar_url:p.avatar_moderation_status==="approved"?p.avatar_url:null,
          country:p.country}}];
    });
    return NextResponse.json(id?(safe.length?{creator:safe[0]}:{error:"Showcase unavailable."}):{creators:safe},{
      status:id&&!safe.length?404:200,headers:{"Cache-Control":"private, no-store"}
    });
  }catch(error){console.error("Public creator directory failed",error);return NextResponse.json({error:"Creator network unavailable."},{status:503});}
}
