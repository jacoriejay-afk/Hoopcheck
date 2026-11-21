import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A creator explicitly publishes only their showcase fields. A private
 * parent account stays private; its name, photo, country and other data are
 * never copied into the public response. A moderator suspension hides it.
 */
export async function GET(request:Request){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({error:"Creator network is not configured."},{status:503});
  const id=new URL(request.url).searchParams.get("id");
  if(id&&!uuid.test(id))return NextResponse.json({error:"Invalid creator."},{status:400});
  try{
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    let query=db.from("creator_profiles").select(
      "profile_id,public_name,country,category,headline,description,website_url,is_published,profiles!inner(id,moderation_status)"
    ).eq("is_published",true).eq("profiles.moderation_status","normal");
    if(id)query=query.eq("profile_id",id);
    const {data,error}=await query.order("created_at",{ascending:false}).limit(id?1:200);
    if(error)throw error;
    const creators=(data||[]).flatMap(row=>{
      const p=Array.isArray(row.profiles)?row.profiles[0]:row.profiles;
      if(!p||p.moderation_status!=="normal"||!row.is_published)return [];
      return [{
        profile_id:row.profile_id,category:row.category,headline:row.headline,
        description:row.description,website_url:row.website_url,
        profiles:{id:row.profile_id,display_name:row.public_name,username:null,
          avatar_url:null,country:row.country}
      }];
    });
    return NextResponse.json(id?(creators.length?{creator:creators[0]}:{error:"Showcase unavailable."}):{creators},{
      status:id&&!creators.length?404:200,headers:{"Cache-Control":"private, no-store"}
    });
  }catch(error){console.error("Public creator showcase failed",error);return NextResponse.json({error:"Creator network unavailable."},{status:503});}
}
