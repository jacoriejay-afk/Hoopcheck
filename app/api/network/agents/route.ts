import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public agents are explicitly opted-in showcases, NEVER private profiles.
 * Server key remains server-only; role and moderation checks stay enforced.
 */
export async function GET(request:Request){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({error:"Directory temporarily unavailable."},{status:503});
  const id=new URL(request.url).searchParams.get("id");
  if(id&&!uuid.test(id))return NextResponse.json({error:"Invalid professional."},{status:400});
  try{
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    let query=db.from("agent_showcases").select(
      "profile_id,public_name,agency_name,headline,description,country,website_url,is_published,profiles!inner(id,account_type,moderation_status,identity_verification_status)"
    ).eq("is_published",true).in("profiles.account_type",["agent","scout"])
     .eq("profiles.moderation_status","normal");
    if(id)query=query.eq("profile_id",id);
    const {data,error}=await query.order("created_at",{ascending:false}).limit(id?1:200);
    if(error)throw error;
    const people=(data||[]).flatMap(row=>{
      const p=Array.isArray(row.profiles)?row.profiles[0]:row.profiles;
      if(!p||!["agent","scout"].includes(p.account_type)||p.moderation_status!=="normal"||!row.is_published)return [];
      return [{
        id:row.profile_id,display_name:row.public_name,username:null,avatar_url:null,
        country:row.country,bio:row.description,experience_summary:row.headline,
        agency_name:row.agency_name,website_url:row.website_url,account_type:p.account_type,
        identity_checked:p.identity_verification_status==="verified"
      }];
    });
    return NextResponse.json(id?(people.length?{person:people[0]}:{error:"Showcase unavailable."}):{people},{
      status:id&&!people.length?404:200,headers:{"Cache-Control":"private, no-store"}
    });
  }catch(error){console.error("Public agent showcase failed",error);return NextResponse.json({error:"Directory unavailable."},{status:503});}
}
