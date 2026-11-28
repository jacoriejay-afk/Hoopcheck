import type { SupabaseClient } from "@supabase/supabase-js";
type ReviewIdentity={id:string;author_id:string|null};
type Kind="men"|"women";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const batchSize=100;
// Never derive a retained review's identity from a profile, title, old ID,
// or pseudonym. Only the server-side verified fact is consumed. Normal rows
// retain legacy behavior, including installations without the candidate RPC.
export async function resolveTrustReviewVerification(db:SupabaseClient,kind:Kind,rows:readonly ReviewIdentity[]){
 const verified=new Map<string,boolean>();
 const authors=new Map<string,boolean>();
 const rowIds=new Set<string>();
 for(const row of rows){
  if(!uuid.test(row.id)||rowIds.has(row.id)||row.author_id!==null&&!uuid.test(row.author_id))throw Error("Invalid review identity.");
  rowIds.add(row.id);
 }
 const authorIds=[...new Set(rows.flatMap(row=>row.author_id===null?[]:[row.author_id]))];
 for(let i=0;i<authorIds.length;i+=batchSize){
  const ids=authorIds.slice(i,i+batchSize);
  const result=await db.from("profiles").select("id,player_verified").in("id",ids);
  if(result.error||!Array.isArray(result.data))throw Error("Review verification unavailable.");
  for(const row of result.data){
   if(!ids.includes(row.id)||authors.has(row.id))throw Error("Invalid review verification response.");
   authors.set(row.id,row.player_verified===true);
  }
 }
 for(const row of rows)if(row.author_id!==null)verified.set(row.id,authors.get(row.author_id)===true);
 const retained=rows.filter(row=>row.author_id===null).map(row=>row.id);
 for(let i=0;i<retained.length;i+=batchSize){
  const ids=retained.slice(i,i+batchSize);
  const result=await db.rpc("get_retained_review_trust_facts",{p_kind:kind,p_ids:ids});
  if(result.error||!Array.isArray(result.data)||result.data.length!==ids.length)throw Error("Retained review verification unavailable.");
  for(const fact of result.data){
   if(!fact||!ids.includes(fact.review_id)||verified.has(fact.review_id)||typeof fact.reviewer_verified!=="boolean")throw Error("Invalid retained review fact.");
   verified.set(fact.review_id,fact.reviewer_verified);
  }
 }
 if(verified.size!==rows.length)throw Error("Incomplete review verification.");
 return verified;
}
