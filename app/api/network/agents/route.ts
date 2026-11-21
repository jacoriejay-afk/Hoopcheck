import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** This route is an explicit public projection, not a replacement for profile RLS.
 * Never return private country, birthdate, contact fields, review data or moderation notes.
 * The service key is server-only, and every query enforces public/moderation/role scope.
 */
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({error:"Directory temporarily unavailable."},{status:503});
  const id = new URL(request.url).searchParams.get("id");
  if (id && !uuid.test(id)) return NextResponse.json({error:"Invalid profile."},{status:400});
  try {
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    let query=db.from("profiles")
      .select("id,display_name,username,avatar_url,avatar_moderation_status,country,bio,experience_summary,account_type,identity_verification_status")
      .in("account_type",["agent","scout"])
      .eq("profile_visibility","public").eq("moderation_status","normal");
    if(id) query=query.eq("id",id);
    const {data,error}=await query.order("display_name",{ascending:true}).limit(id?1:200);
    if(error) throw error;
    const sanitized=(data||[]).map(row=>({
      id:row.id,display_name:row.display_name,username:row.username,
      avatar_url:row.avatar_moderation_status==="approved"?row.avatar_url:null,
      country:row.country,bio:row.bio,experience_summary:row.experience_summary,
      account_type:row.account_type,identity_checked:row.identity_verification_status==="verified"
    }));
    return NextResponse.json(id?sanitized[0]?{person:sanitized[0]}:{error:"Profile unavailable."}:{people:sanitized},{
      status:id&&!sanitized.length?404:200,headers:{"Cache-Control":"private, no-store"}
    });
  }catch(error){console.error("Public agent directory failed",error);return NextResponse.json({error:"Directory unavailable."},{status:503});}
}
