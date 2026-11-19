import { createClient } from "@supabase/supabase-js";
import { appleNotification } from "../../../../lib/server/apple/service";
import { appleReply,appleFailure,appleJson } from "../../../../lib/server/apple/http";
export const dynamic="force-dynamic";
export async function POST(request:Request){try{
 const body=await appleJson(request);const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return appleReply({error:"Notification verification is unavailable."},503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return appleReply(await appleNotification(db,body.signedPayload as string));
}catch(error){return appleFailure(error);}}
