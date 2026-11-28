import type {SupabaseClient} from "@supabase/supabase-js";
import type {DeletionLease} from "./account-deletion-orchestrator";
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
// Sub-operation only; neither receipt is sufficient for the complete step 8.
export async function removeApprovedExportCopiesAndRetainReviews(admin:SupabaseClient,lease:DeletionLease,assertFrozen:(lease:DeletionLease)=>Promise<void>){
 if(!uuid.test(lease.requestId)||!uuid.test(lease.ownerId)||!uuid.test(lease.fence)||!lease.policyVersion)throw Error("Deletion scope invalid.");
 const args={p_request:lease.requestId,p_owner:lease.ownerId,p_fence:lease.fence};
 const boundary=async()=>{if(process.env.ACCOUNT_DELETION_WORKER_ENABLED!=="true")throw Error("Worker disabled.");await assertFrozen(lease);const r=await admin.rpc("assert_account_deletion_worker",args);if(r.error||r.data!==true||process.env.ACCOUNT_DELETION_WORKER_ENABLED!=="true")throw Error("Deletion lease unavailable.");};
 const step=async(name:string,params:Record<string,unknown>,count:string)=>{await boundary();const r=await admin.rpc(name,params);if(r.error||r.data?.ok!==true||typeof r.data[count]!=="number"||!Number.isSafeInteger(r.data[count])||r.data[count]<0)throw Error("Deletion sub-operation not confirmed.");await boundary();};
 // Remove previous owner exports before rotating any review identifiers.
 await step("scrub_approved_deletion_exports",args,"removed_jobs");
 await step("retain_approved_deletion_reviews",{...args,p_apply:true},"retained_count");
 return {confirmed:true as const,receipt:"approved_export_copies_and_retained_reviews_verified"};
}
