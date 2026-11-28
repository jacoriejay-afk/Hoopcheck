// Server-only cleanup adapters for a reviewed, immutable deletion plan.
// Never call from a request handler or accept plan paths from a mobile client.
// Activation requires a real write freeze, fenced worker and reviewed provider scope.
import type { SupabaseClient } from "@supabase/supabase-js";

type Lease = { requestId: string; ownerId: string; fence: string; policyVersion: string };
type ObjectRecord = { id: string; bucket: string; path: string; ownerId: string; version: string | null };
type ApprovedMediaPlan = { requestId: string; ownerId: string; policyVersion: string; objects: readonly ObjectRecord[] };
type Guards = {
  assertLease: (lease: Lease) => Promise<void>;
  assertFrozen: (lease: Lease) => Promise<void>;
  // Read actual catalog metadata, not a client-supplied media URL.
  readObject: (lease: Lease, bucket: string, path: string) => Promise<ObjectRecord | null>;
  assertNoRemainingMedia: (lease: Lease) => Promise<void>;
  // Must confirm the exact prior cleanup checkpoints, lawful retention
  // and no unresolved foreign key, storage or external-provider dependencies.
  assertReadyForAuthDeletion: (lease: Lease) => Promise<void>;
};
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const userBuckets = new Set(["fan-group-images","feed-images","feed-videos","hoopfeed-private-images","hoopfeed-private-videos","player-verification-documents","profile-avatars","profile-claim-proofs"]);
function validLease(l: Lease) {
  if(typeof l.requestId!=="string"||!uuid.test(l.requestId)||typeof l.ownerId!=="string"||!uuid.test(l.ownerId)||typeof l.fence!=="string"||!uuid.test(l.fence)||typeof l.policyVersion!=="string"||!l.policyVersion.trim()||l.policyVersion.length>100)throw Error("Invalid deletion lease.");
}
function immutableLease(l: Lease): Lease {
  validLease(l);
  return Object.freeze({requestId:l.requestId,ownerId:l.ownerId,fence:l.fence,policyVersion:l.policyVersion});
}
function validObject(o: ObjectRecord, owner: string) {
  return !!o&&typeof o.id==="string"&&uuid.test(o.id)&&o.ownerId===owner&&userBuckets.has(o.bucket)&&
    (o.version===null||(typeof o.version==="string"&&o.version.length>0&&o.version.length<=1024))&&
    typeof o.path==="string"&&o.path.length>0&&o.path.length<=1024&&
    !o.path.startsWith("/")&&!o.path.includes("\\")&&!/[\x00-\x1f\x7f]/.test(o.path)&&
    o.path.split("/").every(p=>p!==""&&p!=="."&&p!=="..");
}
function sameObject(a: ObjectRecord,b: ObjectRecord){
  return a.id===b.id&&a.bucket===b.bucket&&a.path===b.path&&a.ownerId===b.ownerId&&a.version===b.version;
}
async function boundary(lease: Lease,guards: Guards){
  await guards.assertLease(lease);await guards.assertFrozen(lease);
}
// Supabase Storage API only: direct SQL DELETE would leave physical bytes behind.
// A successful API response alone is insufficient: re-read the exact metadata.
// Versioned objects, provider copies, legacy ownerless objects and Mux assets
// require additional approved cleanup; assertNoRemainingMedia must verify those.
export async function removeApprovedAccountMedia(admin: SupabaseClient,lease: Lease,plan: ApprovedMediaPlan,guards: Guards){
  lease=immutableLease(lease);
  if(plan.requestId!==lease.requestId||plan.ownerId!==lease.ownerId||plan.policyVersion!==lease.policyVersion||
     !Array.isArray(plan.objects)||plan.objects.length>10000)throw Error("Deletion plan does not match lease.");
  const seen=new Set<string>();
  // Snapshot and validate before the first await; an async proof must not
  // be able to replace the approved object set or mutate a target path.
  const objects: readonly ObjectRecord[]=Object.freeze(Array.from(plan.objects,o=>{
    if(!validObject(o,lease.ownerId))throw Error("Unapproved media object.");
    return Object.freeze({id:o.id,bucket:o.bucket,path:o.path,ownerId:o.ownerId,version:o.version});
  }));
  for(const o of objects){
    const key=JSON.stringify([o.bucket,o.path]);
    if(seen.has(key))throw Error("Duplicate media object.");
    seen.add(key);
  }
  // Verify the whole batch before any deletion; recheck each immediately before effect.
  await boundary(lease,guards);
  for(const o of objects){
    const actual=await guards.readObject(lease,o.bucket,o.path);
    if(actual&&!sameObject(o,actual))throw Error("Media ownership or version changed.");
  }
  for(const o of objects){
    await boundary(lease,guards);
    const actual=await guards.readObject(lease,o.bucket,o.path);
    if(!actual)continue;
    if(!sameObject(o,actual))throw Error("Media ownership or version changed.");
    // A metadata read can outlast the worker lease; recheck immediately
    // before dispatch. A freeze remains required for provider races.
    await boundary(lease,guards);
    const result=await admin.storage.from(o.bucket).remove([o.path]);
    if(result.error)throw Error("Storage deletion not confirmed.");
    await boundary(lease,guards);
    if(await guards.readObject(lease,o.bucket,o.path))throw Error("Media remains after deletion.");
  }
  await boundary(lease,guards);
  await guards.assertNoRemainingMedia(lease);
  await boundary(lease,guards);
  return {confirmed:true as const,receipt:"media_verified"};
}
function isMissingUser(error: unknown){
  return !!error&&typeof error==="object"&&"status" in error&&"code" in error&&error.status===404&&error.code==="user_not_found";
}
// Actual Auth admin hard-delete call; deliberately unavailable until all
// previously approved cleanup/retention and write-freeze proofs are established.
export async function removeApprovedAuthIdentity(admin: SupabaseClient,lease: Lease,guards: Guards){
  lease=immutableLease(lease);
  await boundary(lease,guards);
  await guards.assertReadyForAuthDeletion(lease);
  const before=await admin.auth.admin.getUserById(lease.ownerId);
  if(before.error&&!isMissingUser(before.error))throw Error("Auth lookup not confirmed.");
  if(!before.error){
    if(before.data.user?.id!==lease.ownerId)throw Error("Auth owner mismatch.");
    await boundary(lease,guards);
    await guards.assertReadyForAuthDeletion(lease);
    await boundary(lease,guards);
    const removed=await admin.auth.admin.deleteUser(lease.ownerId,false);
    if(removed.error&&!isMissingUser(removed.error))throw Error("Auth removal not confirmed.");
  }
  await guards.assertLease(lease);
  const after=await admin.auth.admin.getUserById(lease.ownerId);
  if(!isMissingUser(after.error))throw Error("Auth identity absence not confirmed.");
  await guards.assertLease(lease);
  return {confirmed:true as const,receipt:"auth_absence_verified"};
}

// Use supported Auth Admin endpoints. Never mint, retrieve, persist, or log
// a user's bearer for deletion processing. A fresh token may be supplied only
// in memory by the same verified user at an immediate processing handoff.
// Scheduled jobs without a bearer must stop if sessions still exist.
export async function blockAndRevokeApprovedSessions(
 admin:SupabaseClient,lease:Lease,guards:Pick<Guards,"assertLease"|"assertFrozen">,
 ownerBearer?:string,
 options:Readonly<{allowReviewedCatalogRevocation?:boolean}>={},
){
 lease=immutableLease(lease);
 const args={p_request:lease.requestId,p_owner:lease.ownerId,p_fence:lease.fence};
 async function proof(name:string){
  const result=await admin.rpc(name,args);
  if(result.error)throw Error("Deletion session state could not be verified.");
  return result.data===true;
 }
 async function guard(){
  await guards.assertLease(lease);await guards.assertFrozen(lease);
  if(!await proof("assert_deletion_frozen_session_step"))throw Error("Frozen session step not approved.");
 }
 await guard();
 if(ownerBearer){
  const verified=await admin.auth.getUser(ownerBearer);
  if(verified.error||verified.data.user?.id!==lease.ownerId)throw Error("Deletion session owner mismatch.");
 }
 if(!await proof("verify_deletion_auth_login_block")){
  await guard();
  const blocked=await admin.auth.admin.updateUserById(lease.ownerId,{ban_duration:"8760h"});
  if(blocked.error||blocked.data.user?.id!==lease.ownerId)throw Error("Auth login block not confirmed.");
 }
 await guard();
 if(!await proof("verify_deletion_auth_login_block"))throw Error("Auth login block not confirmed.");
 if(!await proof("verify_deletion_session_absence")){
  if(ownerBearer){
   await guard();
   const revoked=await admin.auth.admin.signOut(ownerBearer,"global");
   if(revoked.error)throw Error("Auth global sign-out not confirmed.");
  }
  // The optional version-pinned catalog RPC requires a separate disabled-by-
  // default server flag AND the database's independent policy switch. It also
  // covers legacy refresh tokens not removed by a supported global sign-out.
  if(!await proof("verify_deletion_session_absence")){
   if(!options.allowReviewedCatalogRevocation||process.env.ACCOUNT_DELETION_AUTH_CATALOG_REVOCATION_ENABLED!=="true")throw Error("Existing sessions require verified Auth revocation.");
   await guard();
   if(!await proof("revoke_approved_deletion_auth_sessions"))throw Error("Auth session revocation not confirmed.");
  }
 }
 await guard();
 if(!await proof("verify_deletion_auth_login_block")||!await proof("verify_deletion_session_absence"))throw Error("Auth sessions or login block not verified.");
 return {confirmed:true as const,receipt:"auth_sessions_absent_and_login_blocked"};
}
