// Actual caller-owned row removal effects for the deletion worker. Only
// these fixed repository-verified ownership mappings are supported here.
// Never activate without approved retention scope, verified actual-schema
// dependencies, write freeze and fenced worker. Do not delete reviews,
// subscriptions, profiles, shared posts or billing history from this adapter.
import type {SupabaseClient} from "@supabase/supabase-js";
const mappings=Object.freeze({
 notifications:{table:"notifications",owner:"user_id"},
 saved_feed:{table:"feed_post_bookmarks",owner:"user_id"},
 archived_feed:{table:"feed_post_archives",owner:"user_id"},
 group_memberships:{table:"hoop_group_members",owner:"user_id"},
} as const);
type Category=keyof typeof mappings;
type Lease={requestId:string;ownerId:string;fence:string;policyVersion:string};
type Plan={requestId:string;ownerId:string;policyVersion:string;categories:readonly Category[]};
type Guards={
 assertLease:(lease:Readonly<Lease>)=>Promise<void>;
 assertFrozen:(lease:Readonly<Lease>)=>Promise<void>;
 // Must confirm the exact approved retention/dependency plan on the durable
 // worker record. A generic boolean or caller-provided plan is insufficient.
 assertApprovedCategory:(lease:Readonly<Lease>,category:Category)=>Promise<void>;
};
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
export async function removeApprovedPrivateRows(admin:SupabaseClient,input:Lease,approved:Plan,guards:Guards){
 if(!uuid.test(input.requestId)||!uuid.test(input.ownerId)||!uuid.test(input.fence)||typeof input.policyVersion!=="string"||!input.policyVersion.trim()||input.policyVersion.length>100||approved.requestId!==input.requestId||approved.ownerId!==input.ownerId||approved.policyVersion!==input.policyVersion||!Array.isArray(approved.categories)||!approved.categories.length||approved.categories.length>Object.keys(mappings).length)throw Error("Private deletion scope invalid.");
 const lease=Object.freeze({...input});
 const raw:unknown[]=Array.from(approved.categories);
 if(new Set(raw).size!==raw.length||!raw.every((c):c is Category=>typeof c==="string"&&Object.hasOwn(mappings,c)))throw Error("Private deletion category invalid.");
 const categories:readonly Category[]=Object.freeze(raw);
 async function boundary(category:Category){
  await guards.assertLease(lease);await guards.assertFrozen(lease);
  await guards.assertApprovedCategory(lease,category);
  await guards.assertLease(lease);
 }
 // Verify all approved categories before dispatching the first deletion.
 for(const category of categories)await boundary(category);
 for(const category of categories){
  const map=mappings[category];
  await boundary(category);
  const result=await admin.from(map.table).delete().eq(map.owner,lease.ownerId);
  if(result.error)throw Error("Private row cleanup not confirmed.");
  await boundary(category);
  const readback=await admin.from(map.table).select(map.owner,{count:"exact",head:true}).eq(map.owner,lease.ownerId);
  if(readback.error||readback.count!==0)throw Error("Private rows remain or absence could not be verified.");
  await boundary(category);
 }
 return {confirmed:true as const,receipt:"approved_private_rows_absent"};
}
