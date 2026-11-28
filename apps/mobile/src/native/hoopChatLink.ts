import type {SupabaseClient} from "@supabase/supabase-js";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function parseChatThread(value:unknown):string|null{
 return typeof value==="string"&&uuid.test(value)?value.toLowerCase():null;
}
export type ChatThreadRow={id:string;requester_id:string;player_id:string;message:string|null;status:string;created_at:string};
export async function readLinkedChatThread(client:SupabaseClient,viewer:string,hint:unknown,blocked:ReadonlySet<string>,bearer:string,signal:AbortSignal):Promise<ChatThreadRow|null>{
 const id=parseChatThread(hint);
 if(!id)return null;
 if(!uuid.test(viewer)||!/^Bearer [^\s]+$/.test(bearer)||signal.aborted)throw Error("Conversation unavailable.");
 const r=await client.from("player_contact_requests").select("id,requester_id,player_id,message,status,created_at").eq("id",id).eq("status","accepted").or(`requester_id.eq.${viewer},player_id.eq.${viewer}`).setHeader("Authorization",bearer).abortSignal(signal).maybeSingle();
 if(signal.aborted||r.error)throw Error("Conversation unavailable.");
 const row=r.data;
 if(!row||row.id!==id||row.status!=="accepted"||!uuid.test(row.requester_id)||!uuid.test(row.player_id)||row.requester_id===row.player_id||![row.requester_id,row.player_id].includes(viewer)||blocked.has(row.requester_id===viewer?row.player_id:row.requester_id)||typeof row.created_at!=="string"||!Number.isFinite(Date.parse(row.created_at))||!(row.message===null||typeof row.message==="string"))return null;
 const session=await client.auth.getSession();
 if(signal.aborted||session.error||session.data.session?.user.id!==viewer||"Bearer "+session.data.session.access_token!==bearer)throw Error("Conversation unavailable.");
 return {id:row.id,requester_id:row.requester_id,player_id:row.player_id,message:row.message,status:row.status,created_at:row.created_at};
}
