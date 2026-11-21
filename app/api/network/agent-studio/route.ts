import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic="force-dynamic";
const noStore={"Cache-Control":"private, no-store"};
function clients(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service)throw new Error("Professional Studio not configured");
  return {auth:createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),
    db:createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})};
}
async function getOwner(request:Request,auth: {auth: {getUser: (token: string) => Promise<{data: {user: {id: string} | null}; error: unknown}>}}){
  const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if(!token)return null;
  const {data,error}=await auth.auth.getUser(token);
  return error?null:data.user||null;
}
function site(raw:unknown){
  if(raw===null||raw==="")return null;
  if(typeof raw!=="string"||raw.length>250)return false;
  try{const url=new URL(raw.trim());return url.protocol==="https:"&&!url.username&&!url.password&&url.hostname.includes(".")?url.href:false;}
  catch{return false;}
}
const denied=()=>NextResponse.json({error:"Only agent and scout accounts can publish professional showcases."},{status:403,headers:noStore});
const unavailable=()=>NextResponse.json({error:"Professional Studio is unavailable."},{status:503,headers:noStore});
export async function GET(request:Request){
  try{
    const {auth,db}=clients();
    const user=await getOwner(request,auth);
    if(!user)return NextResponse.json({error:"Sign in to edit your professional showcase."},{status:401,headers:noStore});
    const {data:profile,error}=await db.from("profiles")
      .select("id,account_type,moderation_status,identity_verification_status").eq("id",user.id).maybeSingle();
    if(error||!profile)return unavailable();
    if(!["agent","scout"].includes(profile.account_type))return denied();
    const {data:showcase,error:showcaseError}=await db.from("agent_showcases")
      .select("public_name,agency_name,headline,description,country,website_url,is_published,review_status")
      .eq("profile_id",user.id).maybeSingle();
    if(showcaseError)return unavailable();
    return NextResponse.json({profile:{
      account_type:profile.account_type,moderation_status:profile.moderation_status,
      identity_checked:profile.identity_verification_status==="verified"
    },showcase},{headers:noStore});
  }catch(error){console.error("Professional Studio read failed",error);return unavailable();}
}
export async function PUT(request:Request){
  if(Number(request.headers.get("content-length")||0)>4096)
    return NextResponse.json({error:"Request too large."},{status:413,headers:noStore});
  try{
    const {auth,db}=clients();
    const user=await getOwner(request,auth);
    if(!user)return NextResponse.json({error:"Sign in to edit your professional showcase."},{status:401,headers:noStore});
    const {data:profile,error:profileError}=await db.from("profiles")
      .select("id,account_type,moderation_status").eq("id",user.id).maybeSingle();
    if(profileError||!profile)return unavailable();
    if(!["agent","scout"].includes(profile.account_type))return denied();
    const data=await request.json();
    if(!data||typeof data!=="object"||Array.isArray(data))
      return NextResponse.json({error:"Invalid request."},{status:400,headers:noStore});
    const {public_name,agency_name,headline,description,country,website_url,is_published}=data as Record<string,unknown>;
    const entries:[[unknown,number],...Array<[unknown,number]>]=[
      [public_name,80],[agency_name,120],[headline,140],[description,600],[country,80]
    ];
    if(entries.some(([value,max])=>typeof value!=="string"||value.length>max)
      ||typeof is_published!=="boolean"||(is_published&&(public_name as string).trim().length<2))
      return NextResponse.json({error:"Check professional showcase text and public name."},{status:400,headers:noStore});
    const website=site(website_url);
    if(website===false)return NextResponse.json({error:"Use a valid HTTPS website URL."},{status:400,headers:noStore});
    if(is_published&&profile.moderation_status!=="normal")
      return NextResponse.json({error:"Publishing is unavailable during a moderation restriction."},{status:403,headers:noStore});
    const {data:previous,error:previousError}=await db.from("agent_showcases")
      .select("public_name,agency_name,website_url,review_status").eq("profile_id",user.id).maybeSingle();
    if(previousError)throw previousError;
    const publicIdentityChanged=Boolean(previous && (
      previous.public_name!==(public_name as string).trim() ||
      previous.agency_name!==(agency_name as string).trim() ||
      (previous.website_url||null)!==website
    ));
    const {error}=await db.from("agent_showcases").upsert({
      profile_id:user.id,public_name:(public_name as string).trim(),agency_name:(agency_name as string).trim(),
      headline:(headline as string).trim(),description:(description as string).trim(),
      country:(country as string).trim(),website_url:website,is_published,
      updated_at:new Date().toISOString(),
      ...(publicIdentityChanged?{review_status:"unreviewed",review_note:null,reviewed_at:null,reviewed_by:null}:{})
    },{onConflict:"profile_id"});
    if(error)throw error;
    return NextResponse.json({ok:true,publicly_visible:is_published,review_status:publicIdentityChanged?"unreviewed":(previous?.review_status||"unreviewed")},{headers:noStore});
  }catch(error){console.error("Professional Studio write failed",error);return unavailable();}
}
