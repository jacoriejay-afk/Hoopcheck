import type {SupabaseClient} from "@supabase/supabase-js";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export type GroupUnread=Record<string,number>;
function guard(id:string,bearer:string,signal:AbortSignal){
 if(!uuid.test(id)||!/^Bearer \S+$/.test(bearer)||signal.aborted)throw Error("Group read state unavailable.");
}
export async function readGroupUnread(client:SupabaseClient,space:string,bearer:string,signal:AbortSignal):Promise<GroupUnread>{
 guard(space,bearer,signal);
 const r=await client.rpc("hoop_group_unread_counts",{p_space:space}).setHeader("Authorization",bearer).abortSignal(signal);
 if(signal.aborted||r.error||!Array.isArray(r.data)||r.data.length>100)throw Error("Group unread counts unavailable.");
 const counts:GroupUnread=Object.create(null);
 for(const row of r.data){
  if(typeof row.channel_id!=="string"||!uuid.test(row.channel_id)||Object.hasOwn(counts,row.channel_id)||typeof row.unread_count!=="number"||!Number.isSafeInteger(row.unread_count)||row.unread_count<0)throw Error("Invalid group unread response.");
  counts[row.channel_id]=row.unread_count;
 }
 return counts;
}
export async function markGroupVisibleRead(client:SupabaseClient,channel:string,ids:readonly string[],bearer:string,signal:AbortSignal){
 guard(channel,bearer,signal);
 if(ids.length>100||ids.some(id=>!uuid.test(id)))throw Error("Invalid visible message IDs.");
 const unique=[...new Set(ids)];
 const r=await client.rpc("mark_hoop_group_posts_read",{p_channel:channel,p_posts:unique}).setHeader("Authorization",bearer).abortSignal(signal);
 if(signal.aborted||r.error||!Number.isSafeInteger(r.data)||r.data<0||r.data>unique.length)throw Error("Group read state not confirmed.");
}
