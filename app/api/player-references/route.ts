import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {assuranceForVerifiedUser} from "../../../lib/auth/mfa-core";
import {parseReferenceAction,parseReferenceState} from "../../../apps/mobile/src/native/playerReferences";
export const dynamic="force-dynamic";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:Request){
 if(process.env.HOOPCHECK_PLAYER_REFERENCES_ENABLED!=="true")return reply({error:"References unavailable"},503);
 try{
  const token=request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if(!token||token.length>8192)return reply({error:"Sign in"},401);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return reply({error:"References unavailable"},503);
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return reply({error:"Invalid request"},415);
  const length=request.headers.get("content-length");if(length&&Number(length)>1024)return reply({error:"Invalid request"},413);
  const raw=await request.text();if(raw.length>1024)return reply({error:"Invalid request"},413);
  let input;try{input=parseReferenceAction(JSON.parse(raw));}catch{return reply({error:"Invalid request"},400);}
  if(!input)return reply({error:"Invalid request"},400);
  const db=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user||!user.email_confirmed_at)return reply({error:"Sign in"},401);
  if(assuranceForVerifiedUser(token,user).required)return reply({error:"Verify your session"},403);
  const claims=await db.auth.getClaims(token);
  if(claims.error||claims.data?.claims.role!=="authenticated")return reply({error:"Reference unavailable"},403);
  const result=await db.rpc("player_reference_action",{p_connection_id:input.connectionId,p_action:input.action});
  if(result.error)return reply({error:"Reference unavailable"},result.error.code==="42501"?403:result.error.code==="P0001"?429:503);
  const state=parseReferenceState(result.data);return state?reply(state):reply({error:"Reference unavailable"},503);
 }catch{return reply({error:"Reference unavailable"},503);}
}
