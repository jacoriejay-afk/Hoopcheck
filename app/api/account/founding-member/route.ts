import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assuranceForVerifiedUser } from "../../../../lib/auth/mfa-core";
import { foundingMemberEligible } from "../../../../lib/owner/founding-member";
export const dynamic="force-dynamic";
function reply(body:object,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});}
export async function GET(request:Request){
 if(process.env.HOOPCHECK_FOUNDING_MEMBER_ENABLED!=="true")return reply({eligible:false});
 try{
  const token=request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if(!token||token.length>8192)return reply({eligible:false},401);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return reply({eligible:false},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user||!user.email_confirmed_at)return reply({eligible:false},401);
  if(assuranceForVerifiedUser(token,user).required)return reply({eligible:false},403);
  const claims=await db.auth.getClaims(token);
  if(claims.error||claims.data?.claims.role!=="authenticated")return reply({eligible:false},403);
  return reply({eligible:foundingMemberEligible({enabled:true,cutoff:process.env.HOOPCHECK_FOUNDING_MEMBER_CUTOFF_UTC,createdAt:user.created_at,confirmed:true,now:Date.now()})});
 }catch{return reply({eligible:false},503);}
}
