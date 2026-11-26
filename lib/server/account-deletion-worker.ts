// Server-only integration between the tested orchestration and durable SQL RPCs.
// No scheduler is registered; do not expose this runner as a public route.
// Effects must be real, idempotent, fenced implementations. No dummy receipts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { deletionSteps, runDeletionCandidate, type DeletionLease, type DeletionStep, type DeletionAdapters } from "./account-deletion-orchestrator.ts";

type Effect = (lease: DeletionLease, idempotencyKey: string) => Promise<{confirmed:true;receipt:string}>;
export type DeletionEffects = Record<DeletionStep, Effect>;
type Rpc = Pick<SupabaseClient,"rpc">;
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
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
