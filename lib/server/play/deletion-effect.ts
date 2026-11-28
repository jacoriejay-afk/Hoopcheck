import "server-only";
import type {createDisposablePlayAdapters} from "./disposable-adapters";
type Lease={requestId:string;ownerId:string;fence:string;policyVersion:string};
type Db=ReturnType<typeof createDisposablePlayAdapters>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Adapter for #1203's approved deletion effects. No retention default.
 * The isolated database also independently checks the exact approval. */
export function createPlayCredentialDeletionEffect(db:Db,guards:{assertLease(lease:Lease):Promise<void>;assertFrozen(lease:Lease):Promise<void>;assertApprovedCredentialPurge(lease:Lease):Promise<void>}){
 return async(lease:Lease)=>{
  if(![lease.requestId,lease.ownerId,lease.fence].every(v=>uuid.test(v))||typeof lease.policyVersion!=="string"||!lease.policyVersion||lease.policyVersion.length>128)throw Error("Invalid deletion lease");
  await guards.assertLease(lease);await guards.assertFrozen(lease);await guards.assertApprovedCredentialPurge(lease);
  if(!await db.holdOwner(lease.ownerId))throw Error("Play hold unavailable");
  await guards.assertLease(lease);await guards.assertFrozen(lease);await guards.assertApprovedCredentialPurge(lease);
  if(!await db.purgeApprovedCredentials(lease.requestId,lease.ownerId,lease.fence,lease.policyVersion))throw Error("Play credential purge unavailable");
  return {confirmed:true as const,receipt:"play_test_credentials_purged"};
 };
}
