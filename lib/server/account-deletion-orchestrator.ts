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
