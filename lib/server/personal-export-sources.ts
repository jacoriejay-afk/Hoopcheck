// Caller-scoped personal-data sources. Do not use a service-role client or
// persist a user's token for a background job. These projections cover rows
// visible to the verified caller, not records hidden by RLS or legal holds.
import type { SupabaseClient } from "@supabase/supabase-js";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
type Input={ownerId:string;after:string|null;limit:number;signal:AbortSignal};
type Row={id:string;ownerId:string;data:Record<string,unknown>};
type Mapping={table:string;owner:string;key:string;fields:readonly string[];filter?:readonly [string,string,boolean]};
const maps={
 feed_posts:{table:"feed_posts",owner:"author_id",key:"id",fields:["body","post_kind","created_at","expires_at"],filter:["post_kind","story",false]},
 stories:{table:"feed_posts",owner:"author_id",key:"id",fields:["body","created_at","expires_at","community_visible"],filter:["post_kind","story",true]},
 feed_comments:{table:"feed_post_comments",owner:"author_id",key:"id",fields:["body","created_at","post_id"],filter:undefined},
 messages:{table:"player_contact_messages",owner:"sender_id",key:"id",fields:["body","created_at"]},
 groups:{table:"hoop_group_posts",owner:"author_id",key:"id",fields:["body","created_at","channel_id"]},
 notifications:{table:"notifications",owner:"user_id",key:"id",fields:["notification_type","created_at","read_at"]},
 saved:{table:"feed_post_bookmarks",owner:"user_id",key:"post_id",fields:["post_id","created_at"]},
 billing:{table:"membership_sources",owner:"user_id",key:"id",fields:["plan","status","access_status","current_period_end","cancel_at_period_end","billing_interval","provider"]},
 privacy_requests:{table:"privacy_requests",owner:"requester_id",key:"id",fields:["request_type","status","created_at"]},
} as const satisfies Record<string,Mapping>;
export const personalSourceFields=Object.freeze(Object.fromEntries(Object.entries(maps).map(([name,map])=>[name,Object.freeze([...map.fields])])));
export function createCallerPersonalReaders(client:SupabaseClient,owner:string,bearer:string,verify: (signal:AbortSignal)=>Promise<boolean>){
 if(!uuid.test(owner)||!/^Bearer \S+$/.test(bearer))throw Error("Invalid export identity.");
 async function boundary(input:Input){
  if(input.ownerId!==owner||input.signal.aborted||input.limit!==100||input.after!==null&&!uuid.test(input.after)||!await verify(input.signal)||input.signal.aborted)throw Error("Export caller unavailable.");
 }
 const readers:Record<string,(input:Input)=>Promise<{rows:Row[];hasMore:boolean}>>=Object.create(null);
 for(const [name,definition] of Object.entries(maps)){
  const map:Mapping=definition;
  readers[name]=async input=>{
   await boundary(input);
   const columns=[...new Set([map.key,map.owner,...map.fields])].join(",");
   let query=client.from(map.table).select(columns).eq(map.owner,owner).order(map.key,{ascending:true}).limit(101).setHeader("Authorization",bearer).abortSignal(input.signal);
   if(map.filter){const [column,value,equal]=map.filter;query=equal?query.eq(column,value):query.neq(column,value);}
   if(input.after)query=query.gt(map.key,input.after);
   const result=await query;
   await boundary(input);
   if(result.error||!Array.isArray(result.data)||result.data.length>101)throw Error("Personal source unavailable.");
   // Validate the lookahead as well as the returned page. Never trust a raw
   // relation, nested object, extra column, or another account's record.
   let after=input.after;
   const rows=result.data.map(value=>{
    const row=value as unknown as Record<string,unknown>,id=row?.[map.key];
    if(!row||row[map.owner]!==owner||typeof id!=="string"||!uuid.test(id)||(after!==null&&id<=after))throw Error("Personal source scope mismatch.");
    after=id;const data:Record<string,unknown>=Object.create(null);
    for(const field of map.fields){
     const v=row[field];
     if(!(v===null||typeof v==="boolean"||typeof v==="number"&&Number.isFinite(v)||typeof v==="string"&&v.length<=65536))throw Error("Invalid personal source projection.");
     data[field]=v;
    }
    return {id,ownerId:owner,data};
   });
   return {rows:rows.slice(0,100),hasMore:rows.length===101};
  };
 }
 return Object.freeze(readers);
}
