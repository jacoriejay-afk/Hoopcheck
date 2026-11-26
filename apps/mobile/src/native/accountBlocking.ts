import type { SupabaseClient } from "@supabase/supabase-js";
import { readWithDeadline } from "./readDeadline.ts";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
async function bearer(client:SupabaseClient,uid:string){
  if(!uuid.test(uid))throw Error("Invalid account.");
  const session=await readWithDeadline(()=>client.auth.getSession());
  if(session.error||!session.data.session||session.data.session.user.id!==uid)throw Error("Verify your account.");
  return "Bearer "+session.data.session.access_token;
}
export async function readOutgoingBlocks(client:SupabaseClient,uid:string,signal:AbortSignal){
  const header=await bearer(client,uid);
  if(signal.aborted)throw Error("Block check expired.");
  const result=await client.from("user_blocks").select("blocked_id").eq("blocker_id",uid).limit(501).setHeader("Authorization",header).abortSignal(signal);
  if(result.error||!Array.isArray(result.data)||result.data.length>500||result.data.some(row=>!uuid.test(row.blocked_id))||signal.aborted)throw Error("Blocked accounts could not be verified.");
  await bearer(client,uid);
  if(signal.aborted)throw Error("Block check expired.");
  return new Set<string>(result.data.map(row=>row.blocked_id));
}
export async function blockNativeAccount(client:SupabaseClient,uid:string,target:string,active:()=>boolean){
  if(!uuid.test(target)||target===uid||!active())throw Error("Choose another member.");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const header=await bearer(client,uid);
    if(!active()||controller.signal.aborted)throw Error("Account changed.");
    const result=await client.from("user_blocks").insert({blocker_id:uid,blocked_id:target}).setHeader("Authorization",header).abortSignal(controller.signal);
    if(result.error&&result.error.code!=="23505")throw Error("Block could not be confirmed.");
    const check=await client.from("user_blocks").select("blocked_id").eq("blocker_id",uid).eq("blocked_id",target).setHeader("Authorization",header).abortSignal(controller.signal).maybeSingle();
    if(check.error||check.data?.blocked_id!==target||controller.signal.aborted)throw Error("Block could not be confirmed.");
    await bearer(client,uid);
    if(!active())throw Error("Account changed.");
  }finally{clearTimeout(timer);}
}
