import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assuranceForVerifiedUser } from "../../../../lib/auth/mfa-core";
export const runtime="nodejs";
export async function POST(request:Request){
 const result=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
 if(process.env.HOOPCHECK_FEED_PUBLICATION_RECEIPTS_ENABLED!=="true")return result({error:"Unavailable"},503);
 try{
  const token=request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if(!token)return result({error:"Sign in required"},401);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key||!service)return result({error:"Unavailable"},503);
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data,error}=await admin.auth.getUser(token);
  if(error||!data.user?.email_confirmed_at||assuranceForVerifiedUser(token,data.user).required)return result({error:"Verify account"},403);
  const viewer=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{autoRefreshToken:false,persistSession:false}});
  const active=await viewer.rpc("confirm_active_account_session");
  if(active.error||active.data!==true)return result({error:"Verify account"},403);
  const reader=request.body?.getReader();if(!reader)return result({error:"Invalid request"},400);
  let raw="",bytes=0;const decoder=new TextDecoder();
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>512){await reader.cancel();return result({error:"Invalid request"},400);}raw+=decoder.decode(value,{stream:true});}
  raw+=decoder.decode();const input=JSON.parse(raw);
  if(typeof input?.publication_id!=="string"||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.publication_id)||typeof input.cancel_missing!=="boolean")return result({error:"Invalid request"},400);
  const receipt=await admin.rpc("hoopfeed_publication_receipt",{p_owner:data.user.id,p_key:input.publication_id,p_cancel_missing:input.cancel_missing});
  if(receipt.error||!receipt.data||!["published","removed","cancelled","missing"].includes(receipt.data.state))return result({error:"Receipt unavailable"},503);
  return result({publication_id:input.publication_id,state:receipt.data.state,post_id:receipt.data.post_id??null});
 }catch{return result({error:"Receipt unavailable"},503);}
}
