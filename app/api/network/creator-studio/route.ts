import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic="force-dynamic";
const categories=new Set(["media","podcast","trainer","photographer","analyst","other"]);
function clients(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service)throw new Error("Studio is not configured");
  return {auth:createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),
    db:createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})};
}
async function owner(request:Request,auth:ReturnType<typeof createClient>){
  const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if(!token)return null;
  const {data,error}=await auth.auth.getUser(token);
  return error?null:data.user||null;
}
const noStore={"Cache-Control":"private, no-store"};
const unauthorized=()=>NextResponse.json({error:"Sign in to manage your creator profile."},{status:401,headers:noStore});
const unavailable=()=>NextResponse.json({error:"Creator Studio is unavailable."},{status:503,headers:noStore});

export async function GET(request:Request){
  try{
    const {auth,db}=clients();
    const user=await owner(request,auth);
    if(!user)return unauthorized();
    const [profile,creator]=await Promise.all([
      db.from("profiles").select("id,profile_visibility,moderation_status").eq("id",user.id).maybeSingle(),
      db.from("creator_profiles").select("category,headline,description,website_url,is_published").eq("profile_id",user.id).maybeSingle()
    ]);
    if(profile.error||creator.error||!profile.data)return unavailable();
    return NextResponse.json({profile:profile.data,creator:creator.data},{headers:noStore});
  }catch(error){console.error("Creator Studio read failed",error);return unavailable();}
}
export async function PUT(request:Request){
  if(Number(request.headers.get("content-length")||0)>4096)
    return NextResponse.json({error:"Request too large."},{status:413,headers:noStore});
  try{
    const {auth,db}=clients();
    const user=await owner(request,auth);
    if(!user)return unauthorized();
    const payload=await request.json();
    if(!payload||typeof payload!=="object"||Array.isArray(payload))
      return NextResponse.json({error:"Invalid request."},{status:400,headers:noStore});
    const {category,headline,description,website_url,is_published}=payload as Record<string,unknown>;
    if(typeof category!=="string"||!categories.has(category)||typeof headline!=="string"||typeof description!=="string"
      ||headline.length>140||description.length>600||typeof is_published!=="boolean"
      ||!(website_url===null||website_url===""||typeof website_url==="string"))
      return NextResponse.json({error:"Invalid creator profile fields."},{status:400,headers:noStore});
    const trimmedHeadline=headline.trim(),trimmedDescription=description.trim();
    let site:string|null=null;
    if(typeof website_url==="string"&&website_url.trim()){
      if(website_url.length>250)return NextResponse.json({error:"Website URL is too long."},{status:400,headers:noStore});
      try{
        const parsed=new URL(website_url.trim());
        if(parsed.protocol!=="https:"||parsed.username||parsed.password||!parsed.hostname.includes("."))
          return NextResponse.json({error:"Use a public HTTPS website."},{status:400,headers:noStore});
        site=parsed.href;
      }catch{return NextResponse.json({error:"Invalid HTTPS website."},{status:400,headers:noStore});}
    }
    const {data:profile,error:profileError}=await db.from("profiles").select("id,moderation_status,profile_visibility").eq("id",user.id).maybeSingle();
    if(profileError||!profile)return unavailable();
    // A suspended member cannot create a public showcase, even if the profile
    // is still accidentally flagged as publicly visible.
    if(profile.moderation_status!=="normal"&&is_published)
      return NextResponse.json({error:"Publishing is unavailable while your account has a moderation restriction."},{status:403,headers:noStore});
    const {error}=await db.from("creator_profiles").upsert({
      profile_id:user.id,category,headline:trimmedHeadline,description:trimmedDescription,
      website_url:site,is_published,updated_at:new Date().toISOString()
    },{onConflict:"profile_id"});
    if(error)throw error;
    return NextResponse.json({ok:true,publicly_visible:is_published&&profile.profile_visibility==="public"&&profile.moderation_status==="normal"},{headers:noStore});
  }catch(error){console.error("Creator Studio write failed",error);return unavailable();}
}
