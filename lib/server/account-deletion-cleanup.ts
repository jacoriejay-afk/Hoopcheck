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
  if(!uuid.test(l.requestId)||!uuid.test(l.ownerId)||!uuid.test(l.fence)||!l.policyVersion)throw Error("Invalid deletion lease.");
}
function validObject(o: ObjectRecord, owner: string) {
  return uuid.test(o.id)&&o.ownerId===owner&&userBuckets.has(o.bucket)&&
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
  validLease(lease);
  if(plan.requestId!==lease.requestId||plan.ownerId!==lease.ownerId||plan.policyVersion!==lease.policyVersion||
     !Array.isArray(plan.objects)||plan.objects.length>10000)throw Error("Deletion plan does not match lease.");
  const seen=new Set<string>();
  for(const o of plan.objects){
    if(!validObject(o,lease.ownerId))throw Error("Unapproved media object.");
    const key=JSON.stringify([o.bucket,o.path]);
    if(seen.has(key))throw Error("Duplicate media object.");
    seen.add(key);
  }
  // Verify the whole batch before any deletion; recheck each immediately before effect.
  await boundary(lease,guards);
  for(const o of plan.objects){
    const actual=await guards.readObject(lease,o.bucket,o.path);
    if(actual&&!sameObject(o,actual))throw Error("Media ownership or version changed.");
  }
  for(const o of plan.objects){
    await boundary(lease,guards);
    const actual=await guards.readObject(lease,o.bucket,o.path);
    if(!actual)continue;
    if(!sameObject(o,actual))throw Error("Media ownership or version changed.");
    const result=await admin.storage.from(o.bucket).remove([o.path]);
    if(result.error)throw Error("Storage deletion not confirmed.");
    await boundary(lease,guards);
    if(await guards.readObject(lease,o.bucket,o.path))throw Error("Media remains after deletion.");
  }
  await boundary(lease,guards);
  await guards.assertNoRemainingMedia(lease);
  return {confirmed:true as const,receipt:"media_verified"};
}
function isMissingUser(error: unknown){
  return !!error&&typeof error==="object"&&"status" in error&&"code" in error&&error.status===404&&error.code==="user_not_found";
}
// Actual Auth admin hard-delete call; deliberately unavailable until all
// previously approved cleanup/retention and write-freeze proofs are established.
export async function removeApprovedAuthIdentity(admin: SupabaseClient,lease: Lease,guards: Guards){
  validLease(lease);
  await boundary(lease,guards);
  await guards.assertReadyForAuthDeletion(lease);
  const before=await admin.auth.admin.getUserById(lease.ownerId);
  if(before.error&&!isMissingUser(before.error))throw Error("Auth lookup not confirmed.");
  if(!before.error){
    if(before.data.user?.id!==lease.ownerId)throw Error("Auth owner mismatch.");
    await boundary(lease,guards);
    await guards.assertReadyForAuthDeletion(lease);
    const removed=await admin.auth.admin.deleteUser(lease.ownerId,false);
    if(removed.error&&!isMissingUser(removed.error))throw Error("Auth removal not confirmed.");
  }
  await guards.assertLease(lease);
  const after=await admin.auth.admin.getUserById(lease.ownerId);
  if(!isMissingUser(after.error))throw Error("Auth identity absence not confirmed.");
  return {confirmed:true as const,receipt:"auth_absence_verified"};
}
