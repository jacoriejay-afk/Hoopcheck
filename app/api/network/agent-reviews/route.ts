import {createClient} from "@supabase/supabase-js";
import {NextResponse} from "next/server";

export const dynamic="force-dynamic";
const noStore={"Cache-Control":"private, no-store"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function clients(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service)throw new Error("Agent verification isn't configured");
  return {url,anon,db:createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})};
}
async function reviewer(request:Request,url:string,anon:string){
  const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if(!token)return null;
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await auth.auth.getUser(token);
  if(error||!user)return null;
  const scoped=createClient(url,anon,{
    global:{headers:{Authorization:"Bearer "+token}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const role=await scoped.rpc("get_current_user_admin_role");
  if(role.error||!["admin","moderator"].includes(String(role.data||"")))return null;
  return user;
}
const forbidden=()=>NextResponse.json({error:"An authorized moderator session is required."},{status:403,headers:noStore});
const unavailable=()=>NextResponse.json({error:"Agent verification queue is unavailable."},{status:503,headers:noStore});

export async function GET(request:Request){
  try{
    const {url,anon,db}=clients();
    if(!await reviewer(request,url,anon))return forbidden();
    const {data,error}=await db.from("agent_showcases").select(
      "profile_id,public_name,agency_name,website_url,country,is_published,updated_at,review_status,review_note,reviewed_at,profiles!agent_showcases_profile_id_fkey!inner(account_type,moderation_status)"
    ).eq("is_published",true).in("profiles.account_type",["agent","scout"])
      .eq("profiles.moderation_status","normal").order("updated_at",{ascending:false}).limit(100);
    if(error)throw error;
    return NextResponse.json({showcases:data||[]},{headers:noStore});
  }catch(error){console.error("Agent review list failed",error);return unavailable();}
}
export async function POST(request:Request){
  if(Number(request.headers.get("content-length")||0)>4096)
    return NextResponse.json({error:"Review is too large."},{status:413,headers:noStore});
  try{
    const {url,anon,db}=clients();
    const user=await reviewer(request,url,anon);
    if(!user)return forbidden();
    const body=await request.json();
    const {profile_id,approved,review_note,expected_updated_at}=body||{};
    if(typeof profile_id!=="string"||!uuid.test(profile_id)||typeof approved!=="boolean"
      ||typeof review_note!=="string"||review_note.trim().length<30||review_note.length>1000
      ||typeof expected_updated_at!=="string")
      return NextResponse.json({error:"Select a showcase and document the independent review (at least 30 characters)."},
        {status:400,headers:noStore});
    if(user.id===profile_id)return NextResponse.json({error:"You cannot review your own showcase."},{status:403,headers:noStore});
    const {data:record,error:lookupError}=await db.from("agent_showcases").select(
      "profile_id,is_published,updated_at,profiles!agent_showcases_profile_id_fkey!inner(account_type,moderation_status)"
    ).eq("profile_id",profile_id).maybeSingle();
    const p=Array.isArray(record?.profiles)?record.profiles[0]:record?.profiles;
    if(lookupError||!record||!record.is_published||!p
      ||!["agent","scout"].includes(p.account_type)||p.moderation_status!=="normal")
      return NextResponse.json({error:"Eligible published professional not found."},{status:404,headers:noStore});
    if(record.updated_at!==expected_updated_at)
      return NextResponse.json({error:"This showcase changed. Refresh before reviewing."},{status:409,headers:noStore});
    const {data,error}=await db.from("agent_showcases").update({
      review_status:approved?"approved":"rejected",review_note:review_note.trim(),
      reviewed_at:new Date().toISOString(),reviewed_by:user.id
    }).eq("profile_id",profile_id).eq("updated_at",expected_updated_at).select("profile_id").maybeSingle();
    if(error)throw error;
    if(!data)return NextResponse.json({error:"Showcase changed; refresh the review queue."},{status:409,headers:noStore});
    return NextResponse.json({ok:true},{headers:noStore});
  }catch(error){console.error("Agent review update failed",error);return unavailable();}
}
