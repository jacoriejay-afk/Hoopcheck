import type {SupabaseClient} from "@supabase/supabase-js";
import {sendConversationMessage} from "./hoopChatSend.ts";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
type Storage={get:(key:string)=>Promise<string|null>;set:(key:string,value:string)=>Promise<void>;remove:(key:string)=>Promise<void>};
type Lock=<T>(key:string,run:()=>Promise<T>)=>Promise<T>;
export function chatOutboxKey(owner:string,thread:string){
 if(!uuid.test(owner)||!uuid.test(thread))throw Error("Invalid conversation.");
 return "hoopcheck:chat-delivery:v1:"+owner+":"+thread;
}
export function createChatOutbox(storage:Storage,lock:Lock,createId:()=>string){
 async function recover(client:SupabaseClient,owner:string,thread:string,id:string,bearer:string,signal:AbortSignal,structured:boolean){
  if(!uuid.test(id)||signal.aborted||!/^Bearer [^\s]+$/.test(bearer))throw Error("Delivery verification unavailable.");
  const {data,error}=await client.from("player_contact_messages").select(structured?"id,request_id,sender_id,body,reply_to_id":"id,request_id,sender_id,body").eq("id",id).eq("request_id",thread).eq("sender_id",owner).setHeader("Authorization",bearer).abortSignal(signal).maybeSingle();
  if(error||signal.aborted)throw Error("Delivery verification unavailable.");
  if(data===null)return null;
  if(data.id!==id||data.request_id!==thread||data.sender_id!==owner||typeof data.body!=="string")throw Error("Invalid delivery receipt.");
  const row=data as unknown as {body:string;reply_to_id?:string|null};
  if(structured&&row.reply_to_id!==null&&(typeof row.reply_to_id!=="string"||!uuid.test(row.reply_to_id)))throw Error("Invalid reply receipt.");
  return row;
 }
 async function check(client:SupabaseClient,owner:string,bearer:string,signal:AbortSignal){
  const session=await client.auth.getSession();
  if(signal.aborted||session.error||session.data.session?.user.id!==owner||"Bearer "+session.data.session.access_token!==bearer)throw Error("Account changed.");
 }
 async function send(client:SupabaseClient,owner:string,thread:string,body:string,reply:string|undefined,bearer:string,signal:AbortSignal,structured:boolean){
  const key=chatOutboxKey(owner,thread),text=body.trim().slice(0,2000);
  if(!text||reply!==undefined&&(!structured||!uuid.test(reply)))throw Error("Invalid message.");
  return lock(key,async()=>{
   await check(client,owner,bearer,signal);
   let id=await storage.get(key);
   if(id){
    const row=await recover(client,owner,thread,id,bearer,signal,structured);
    if(row){
     await check(client,owner,bearer,signal);
     if(await storage.get(key)===id)await storage.remove(key);
     return row.body===text&&(!structured||(row.reply_to_id??undefined)===reply)?"sent" as const:"previous_delivered" as const;
    }
   }else{
    id=createId();if(!uuid.test(id))throw Error("Invalid message identifier.");
    await storage.set(key,id);
   }
   // Persist only the id, never the message or reply content. Retrying a
   // missing receipt deliberately reuses the id, even after an app restart.
   await check(client,owner,bearer,signal);
   await sendConversationMessage(client,{id,request_id:thread,sender_id:owner,body:text,...(reply?{reply_to_id:reply}:{})},signal,bearer);
   await check(client,owner,bearer,signal);
   if(await storage.get(key)===id)await storage.remove(key);
   return "sent" as const;
  });
 }
 async function status(client:SupabaseClient,owner:string,thread:string,bearer:string,signal:AbortSignal,structured:boolean){
  const key=chatOutboxKey(owner,thread);
  return lock(key,async()=>{
   await check(client,owner,bearer,signal);
   const id=await storage.get(key);if(!id)return "none" as const;
   const row=await recover(client,owner,thread,id,bearer,signal,structured);
   await check(client,owner,bearer,signal);
   // Do not discard an unresolved ID: a delayed insert can still commit.
   if(!row)return "unconfirmed" as const;
   if(await storage.get(key)===id)await storage.remove(key);
   return "delivered" as const;
  });
 }
 return {send,status};
}
export const chatDeliveryMessage=(status:"none"|"unconfirmed"|"delivered")=>status==="none"?"No pending delivery.":status==="delivered"?"Previous message was delivered. Review the conversation before sending again.":"Delivery is unconfirmed. Re-enter the original message and reply, then retry. The same message ID will be used.";
