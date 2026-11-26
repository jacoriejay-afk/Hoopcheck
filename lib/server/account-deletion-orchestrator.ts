// Review-only orchestration. No production adapter or scheduler is supplied.
// All effects must use a durable request/step idempotency key and lease fencing.
// Never infer completion from a timeout, a missing row, or an HTTP 202.
export const deletionSteps = [
  "approve_scope", "capture_completion_contact", "freeze_account_writes",
  "revoke_sessions", "preserve_lawful_billing_records", "revoke_apple_authorizations",
  "remove_user_media", "remove_or_anonymize_user_data", "delete_auth_identity",
  "verify_erasure", "notify_completion", "remove_completion_contact",
] as const;
export type DeletionStep = typeof deletionSteps[number];
export type DeletionLease = {
  requestId: string; ownerId: string; fence: string; completed: readonly DeletionStep[];
  policyVersion: string;
};
type StepResult = { confirmed: true; receipt: string };
export type DeletionAdapters = {
  enabled: () => Promise<boolean>;
  claim: () => Promise<DeletionLease | null>;
  // Must reject stale leases and guarantee one execution boundary per step.
  assertLease: (lease: DeletionLease) => Promise<void>;
  execute: (lease: DeletionLease, step: DeletionStep, idempotencyKey: string) => Promise<StepResult>;
  checkpoint: (lease: DeletionLease, step: DeletionStep, receipt: string) => Promise<void>;
  complete: (lease: DeletionLease) => Promise<void>;
  // Only store controlled codes, never error details, provider credentials or PII.
  fail: (lease: DeletionLease, code: "invalid_checkpoint" | "step_not_confirmed") => Promise<void>;
};
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export async function runDeletionCandidate(adapter: DeletionAdapters): Promise<"disabled"|"idle"|"completed"|"retry"> {
  if (!await adapter.enabled()) return "disabled";
  const lease = await adapter.claim();
  if (!lease) return "idle";
  if (!uuid.test(lease.requestId) || !uuid.test(lease.ownerId) || !uuid.test(lease.fence) ||
      !lease.policyVersion || lease.completed.length > deletionSteps.length ||
      lease.completed.some((step,index)=>step!==deletionSteps[index])) {
    // Do not attempt to mutate a malformed lease supplied by the scheduler.
    throw new Error("Invalid deletion lease or checkpoint sequence.");
  }
  try {
    for (const step of deletionSteps.slice(lease.completed.length)) {
      await adapter.assertLease(lease);
      const result = await adapter.execute(lease,step,lease.requestId+":"+step);
      if(result?.confirmed!==true||typeof result.receipt!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(result.receipt))
        throw new Error("Deletion step not acknowledged.");
      await adapter.assertLease(lease);
      await adapter.checkpoint(lease,step,result.receipt);
    }
    await adapter.assertLease(lease);
    await adapter.complete(lease);
    return "completed";
  } catch {
    // A fenced-out worker must not update the current worker's state.
    try { await adapter.assertLease(lease); await adapter.fail(lease,"step_not_confirmed"); } catch { /* lease lost; durable scheduler owns retry */ }
    return "retry";
  }
}

// Durable database RPC integration; no scheduler or live effect implementations registered.
type Effect = (lease: DeletionLease, idempotencyKey: string) => Promise<{confirmed:true;receipt:string}>;
export type DeletionEffects = Record<DeletionStep, Effect>;
type Rpc = {rpc:(name:string,args?:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
function bindings(lease: DeletionLease) {
 return {p_request:lease.requestId,p_owner:lease.ownerId,p_fence:lease.fence};
}
function decodeClaim(value:unknown):DeletionLease|null {
 if(!Array.isArray(value)||value.length>1)throw Error("Invalid deletion claim.");
 if(!value.length)return null;
 const row=value[0];
 if(!row||typeof row!=="object"||!uuid.test(row.request_id)||!uuid.test(row.owner_id)||!uuid.test(row.fence)||
  typeof row.policy_version!=="string"||!row.policy_version||row.policy_version.length>100||
  !Array.isArray(row.completed)||row.completed.length>deletionSteps.length||
  row.completed.some((step:unknown,index:number)=>step!==deletionSteps[index]))throw Error("Invalid deletion claim.");
 return {requestId:row.request_id,ownerId:row.owner_id,fence:row.fence,policyVersion:row.policy_version,completed:row.completed};
}
export function createDeletionWorkerAdapter(client:Rpc,effects:DeletionEffects,enabled:boolean):DeletionAdapters {
 async function rpc(name:string,args?:Record<string,unknown>){
  const r=await client.rpc(name,args);
  if(r.error)throw Error("Deletion worker database acknowledgement failed.");
  return r.data;
 }
 async function acknowledged(name:string,args:Record<string,unknown>){
  if(await rpc(name,args)!==true)throw Error("Deletion worker transition not confirmed.");
 }
 return {
  enabled:async()=>enabled&&process.env.ACCOUNT_DELETION_WORKER_ENABLED==="true"&&deletionSteps.every(step=>typeof effects[step]==="function"),
  claim:async()=>decodeClaim(await rpc("claim_account_deletion_worker")),
  assertLease:async lease=>acknowledged("assert_account_deletion_worker",bindings(lease)),
  execute:async(lease,step,key)=>{
   if(key!==lease.requestId+":"+step||typeof effects[step]!=="function")throw Error("Deletion effect unavailable.");
   await acknowledged("assert_account_deletion_worker",bindings(lease));
   return effects[step](lease,key);
  },
  checkpoint:async(lease,step,receipt)=>acknowledged("checkpoint_account_deletion_worker",{...bindings(lease),p_step:step,p_receipt:receipt}),
  complete:async lease=>acknowledged("complete_account_deletion_worker",bindings(lease)),
  fail:async(lease,code)=>acknowledged("fail_account_deletion_worker",{...bindings(lease),p_code:code}),
 };
}
export async function runOneApprovedDeletion(client:Rpc,effects:DeletionEffects,enabled=false) {
 return runDeletionCandidate(createDeletionWorkerAdapter(client,effects,enabled));
}

/** Provider-specific worker step. Supply the reviewed Apple cryptographic
 * revoke helper from #1080 after dependency integration. Never log envelopes.
 * The worker may retry after an Apple success and before database ACK:
 * Apple documents that /auth/revoke returns 200 for previously invalidated tokens.
 */
export async function revokeDeletionAppleAuthorizations(client:Rpc,lease:DeletionLease,revoke:(envelope:string,owner:string,subject:string)=>Promise<void>) {
 const args=bindings(lease);
 async function list(){
  const r=await client.rpc("list_account_deletion_apple_revocations",args);
  if(r.error||!Array.isArray(r.data)||r.data.length>32)throw Error("Apple revocation scope not confirmed.");
  const seen=new Set<string>();
  for(const row of r.data){
   if(!row||typeof row.apple_subject!=="string"||!row.apple_subject||row.apple_subject.length>255||
      typeof row.envelope!=="string"||row.envelope.length>12000||!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(row.envelope)||
      typeof row.envelope_digest!=="string"||!/^[a-f0-9]{64}$/.test(row.envelope_digest)||seen.has(row.apple_subject))throw Error("Invalid Apple revocation scope.");
   seen.add(row.apple_subject);
  }
  return r.data as {apple_subject:string;envelope:string;envelope_digest:string}[];
 }
 const rows=await list();
 for(const row of rows){
  const check=await client.rpc("assert_account_deletion_worker",args);
  if(check.error||check.data!==true)throw Error("Deletion lease lost.");
  await revoke(row.envelope,lease.ownerId,row.apple_subject);
  const ack=await client.rpc("ack_account_deletion_apple_revocation",{...args,p_subject:row.apple_subject,p_digest:row.envelope_digest});
  if(ack.error||ack.data!==true)throw Error("Apple revocation acknowledgement failed.");
 }
 if((await list()).length!==0)throw Error("Apple authorizations remain.");
 return {confirmed:true as const,receipt:"apple_revocations_verified"};
}
