import type {SupabaseClient} from "@supabase/supabase-js";
import type {ChatThreadRow} from "./hoopChatLink.ts";
// Retain the database timestamp as-is to preserve sub-millisecond cursors.
const timestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const validId=(value:unknown):value is string=>typeof value==="string"&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const CHAT_INBOX_PAGE_SIZE=100;
export const CHAT_INBOX_MAX_PAGES=5;
export function chatInboxBatches<T>(rows:readonly T[]):T[][]{
 const batches:T[][]=[];for(let i=0;i<rows.length;i+=CHAT_INBOX_PAGE_SIZE)batches.push(rows.slice(i,i+CHAT_INBOX_PAGE_SIZE));return batches;
}
export async function readChatInbox(client:SupabaseClient,viewer:string,bearer:string,signal:AbortSignal,pages:number,blocked:ReadonlySet<string>){
 if(!validId(viewer)||!/^Bearer [^\s]+$/.test(bearer)||signal.aborted||!Number.isSafeInteger(pages)||pages<1||pages>CHAT_INBOX_MAX_PAGES)throw Error("Invalid inbox request.");
 const seen=new Set<string>(),rows:ChatThreadRow[]=[];
 let cursor:Pick<ChatThreadRow,"id"|"created_at">|null=null,hasMore=false;
 for(let page=0;page<pages;page++){
  if(signal.aborted)throw Error("Conversation list cancelled.");
  let q=client.from("player_contact_requests").select("id,requester_id,player_id,message,status,created_at")
   .or(`requester_id.eq.${viewer},player_id.eq.${viewer}`).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(CHAT_INBOX_PAGE_SIZE);
  if(cursor)q=q.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const result=await q.setHeader("Authorization",bearer).abortSignal(signal);
  if(signal.aborted||result.error||!Array.isArray(result.data)||result.data.length>CHAT_INBOX_PAGE_SIZE)throw Error("Conversation list unavailable.");
  for(const row of result.data){
   if(!row||!validId(row.id)||!validId(row.requester_id)||!validId(row.player_id)||row.requester_id===row.player_id||![row.requester_id,row.player_id].includes(viewer)||!["pending","accepted","rejected"].includes(row.status)||!(row.message===null||typeof row.message==="string")||typeof row.created_at!=="string"||!timestamp.test(row.created_at)||!Number.isFinite(Date.parse(row.created_at))||seen.has(row.id))throw Error("Invalid conversation page.");
   seen.add(row.id);
   cursor={id:row.id,created_at:row.created_at};
   if(!blocked.has(row.requester_id===viewer?row.player_id:row.requester_id))rows.push({id:row.id,requester_id:row.requester_id,player_id:row.player_id,message:row.message,status:row.status,created_at:row.created_at});
  }
  hasMore=result.data.length===CHAT_INBOX_PAGE_SIZE;
  if(!hasMore)break;
 }
 const latest=await client.auth.getSession();
 if(signal.aborted||latest.error||latest.data.session?.user.id!==viewer||"Bearer "+latest.data.session.access_token!==bearer)throw Error("Account changed.");
 return {rows,hasMore,atLimit:hasMore&&pages===CHAT_INBOX_MAX_PAGES};
}
