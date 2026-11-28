import type {SupabaseClient} from "@supabase/supabase-js";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export type GroupSend={id:string;owner:string;channel:string;body:string};
/** Keep the exact client-generated ID for an uncertain send. Never reuse it
 * for a different identity, channel or body. Database primary key is the fence. */
export function prepareGroupSend(previous:GroupSend|null,owner:string,channel:string,text:string,newId:()=>string):GroupSend{
 const body=text.trim().slice(0,1200);
 if(!uuid.test(owner)||!uuid.test(channel)||!body)throw Error("Invalid message.");
 if(previous&&previous.owner===owner&&previous.channel===channel&&previous.body===body)return previous;
 const id=newId();if(!uuid.test(id))throw Error("Invalid message ID.");
 return Object.freeze({id,owner,channel,body});
}
export async function submitGroupSend(client:SupabaseClient,message:GroupSend,bearer:string,signal:AbortSignal){
 const {id,owner,channel,body}=message;
 if(!uuid.test(id)||!uuid.test(owner)||!uuid.test(channel)||!body||body.length>1200||!/^Bearer \S+$/.test(bearer)||signal.aborted)throw Error("Invalid message request.");
 async function check(){
  if(signal.aborted)throw Error("Message confirmation cancelled.");
  const r=await client.from("hoop_group_posts").select("id,author_id,channel_id,body,moderation_status")
   .eq("id",id).eq("author_id",owner).eq("channel_id",channel).setHeader("Authorization",bearer).abortSignal(signal).maybeSingle();
  if(signal.aborted||r.error)throw Error("Message confirmation unavailable.");
  if(!r.data)return false;
  if(r.data.id!==id||r.data.author_id!==owner||r.data.channel_id!==channel||r.data.body!==body||!["pending","approved","rejected","removed"].includes(r.data.moderation_status))throw Error("Message identity mismatch.");
  return true;
 }
 if(await check())return;
 if(signal.aborted)throw Error("Message confirmation cancelled.");
 const sent=await client.from("hoop_group_posts").insert({id,channel_id:channel,author_id:owner,body,moderation_status:"pending"})
  .setHeader("Authorization",bearer).abortSignal(signal);
 // A duplicate primary key may represent an earlier successful attempt.
 // Slow-mode or unrelated conflicts never count as a successful send.
 if(signal.aborted)throw Error("Message confirmation cancelled.");
 if(await check())return;
 throw Error(sent.error?"Message not confirmed. Retry the unchanged draft; slow mode still applies.":"Message confirmation unavailable. Retry the unchanged draft.");
}
