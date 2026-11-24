import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assuranceForVerifiedUser } from "../../../../lib/auth/mfa-core";

export const dynamic = "force-dynamic";
const fields = "id,account_type,display_name,bio,username,first_name,last_name,years_pro,current_country,current_country_public,position,height,free_agent,current_team,profile_visibility,hometown,nationality,interests,favorite_leagues,favorite_teams,experience_summary,avatar_url,avatar_moderation_status,player_verified,player_verified_at,created_at,updated_at,is_adult,agreed_to_terms,moderation_status,notification_preferences";
function reply(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});}
export async function GET(request:Request){
  const token=/^Bearer ([^\s]{1,16384})$/i.exec(request.headers.get("authorization")||"")?.[1];
  if(!token)return reply({error:"Sign in to verify your profile."},401);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return reply({error:"Profile service is unavailable."},503);
  try{
    const scoped=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const auth=await scoped.auth.getUser(token);
    if(auth.error||!auth.data.user)return reply({error:"Sign in again."},401);
    const user=auth.data.user,claims=await scoped.auth.getClaims(token);
    if(claims.error||claims.data?.claims.role!=="authenticated"||user.is_anonymous===true||claims.data.claims.is_anonymous===true||assuranceForVerifiedUser(token,user).required)return reply({error:"Complete security verification first."},403);
    // No arbitrary target ID, service-role credentials or direct client table fallback.
    // Prefer the protected RPC after migration; only the precisely absent RPC
    // permits an RLS-bound, allowlisted legacy read under the same verified JWT.
    let result=await scoped.rpc("get_own_profile");
    if(result.error?.code==="PGRST202"){
      result=await scoped.from("profiles").select(fields).eq("id",user.id).maybeSingle();
    }
    if(result.error||!result.data||typeof result.data!=="object"||Array.isArray(result.data)||result.data.id!==user.id)return reply({error:"Profile could not be verified."},503);
    const row=result.data as Record<string,unknown>;
    const profile=Object.fromEntries(fields.split(",").filter(field=>Object.hasOwn(row,field)).map(field=>[field,row[field]]));
    return reply({owner:user.id,profile});
  }catch{return reply({error:"Profile could not be verified."},503);}
}
