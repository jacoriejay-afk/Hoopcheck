import type {SupabaseClient} from "@supabase/supabase-js";
import type {ChatThreadRow} from "./hoopChatLink.ts";
export type InboxCursor={id:string;created_at:string};
export type InboxMode="all"|"conversations"|"requests";
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const stamp=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
export async function readServerInbox(client:SupabaseClient,viewer:string,bearer:string,signal:AbortSignal,query:string,mode:InboxMode,cursor:InboxCursor|null,blocked:ReadonlySet<string>){
 if(!uuid(viewer)||!/^Bearer [^\s]+$/.test(bearer)||signal.aborted||query.length>80||!["all","conversations","requests"].includes(mode)||cursor&&(!uuid(cursor.id)||!stamp(cursor.created_at)))throw Error("Invalid conversation search.");
 const result=await client.rpc("hoopchat_inbox_page",{p_query:query,p_mode:mode,p_before_at:cursor?.created_at??null,p_before_id:cursor?.id??null}).setHeader("Authorization",bearer).abortSignal(signal);
 const data=result.data;
 if(signal.aborted||result.error||!data||!Array.isArray(data.rows)||data.rows.length>100||typeof data.has_more!=="boolean"||data.has_more&&data.rows.length!==100)throw Error("Conversation search unavailable.");
 const rows:ChatThreadRow[]=[],seen=new Set<string>();let next:InboxCursor|null=null;
 for(const row of data.rows){
 if(!row||!uuid(row.id)||!uuid(row.requester_id)||!uuid(row.player_id)||row.requester_id===row.player_id||![row.requester_id,row.player_id].includes(viewer)||!["accepted","pending","rejected"].includes(row.status)||mode==="conversations"&&row.status!=="accepted"||mode==="requests"&&row.status!=="pending"||!stamp(row.created_at)||!(row.message===null||typeof row.message==="string")||seen.has(row.id)||row.id===cursor?.id)throw Error("Invalid conversation page.");
 seen.add(row.id);next={id:row.id,created_at:row.created_at};
 if(!blocked.has(row.requester_id===viewer?row.player_id:row.requester_id))rows.push({id:row.id,requester_id:row.requester_id,player_id:row.player_id,message:row.message,status:row.status,created_at:row.created_at});
 }
 const session=await client.auth.getSession();
 if(signal.aborted||session.error||session.data.session?.user.id!==viewer||"Bearer "+session.data.session.access_token!==bearer)throw Error("Account changed.");
 return {rows,hasMore:data.has_more as boolean,atLimit:false,next:data.has_more?next:null};
}
export async function readAllUnread(client:SupabaseClient,bearer:string,signal:AbortSignal){
 const r=await client.rpc("hoopchat_unread_total").setHeader("Authorization",bearer).abortSignal(signal);
 if(signal.aborted||r.error||!Number.isSafeInteger(r.data)||r.data<0)throw Error("Account unread count unavailable.");
 return r.data as number;
}
