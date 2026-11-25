import { planBasketballSync, type SyncJob, type SyncPool, type PoolSnapshot } from "./hoopdata-sync-policy";

export type SyncOutcome = { state: "staged" } | { state: "deferred" | "failed"; retryAt?: number };
export type SyncLease = { id: string; token: string; expiresAt: number };
export type DispatchDependencies = {
  now: () => number;
  // Must atomically recheck approval, due time, and exclusivity in durable storage.
  claim: (job: SyncJob, now: number, leaseMs: number) => Promise<SyncLease | null>;
  // Implementations must use quota-first fetchers and fence all writes by lease token.
  execute: (job: SyncJob, lease: SyncLease, signal: AbortSignal) => Promise<SyncOutcome>;
  // Compare-and-set by lease token; expired or superseded owners must not commit.
  finish: (lease: SyncLease, outcome: SyncOutcome, now: number) => Promise<boolean>;
};
export type DispatchRecord = { id: string; state: "staged" | "deferred" | "failed" | "not-claimed" | "storage-unavailable" | "lease-lost" };
const LEASE_MS = 60_000;
const EXECUTION_MS = 20_000;
const RETRY_MS = 60_000;
const validTime = (n: number) => Number.isSafeInteger(n) && n >= 0;

/** Sequential, bounded dispatcher. Not a scheduler or a durable store.
 * Only use adapters with atomic claims, durable quota reservation, and fenced writes.
 * Stop on persistence uncertainty; never retry a provider call within this invocation.
 */
export async function dispatchBasketballSync(
  jobs: readonly SyncJob[], pools: Partial<Record<SyncPool, PoolSnapshot>>, deps: DispatchDependencies, maxJobs = 4,
): Promise<DispatchRecord[]> {
  const plan = planBasketballSync(jobs, pools, deps.now(), maxJobs);
  const byId = new Map(jobs.map(job => [job.id, job]));
  const records: DispatchRecord[] = [];
  for (const id of plan.selected) {
    const job = byId.get(id)!;
    const start = deps.now();
    if (!validTime(start)) throw Error("Invalid dispatch clock");
    let lease: SyncLease | null;
    try { lease = await deps.claim(job, start, LEASE_MS); }
    catch { records.push({id,state:"storage-unavailable"}); break; }
    if (!lease) { records.push({id,state:"not-claimed"}); continue; }
    if (lease.id !== id || typeof lease.token !== "string" || !lease.token ||
        !validTime(lease.expiresAt) || lease.expiresAt <= deps.now() + EXECUTION_MS) {
      records.push({id,state:"lease-lost"}); break;
    }
    const signal = AbortSignal.timeout(EXECUTION_MS);
    let outcome: SyncOutcome;
    try { outcome = await deps.execute(job, lease, signal); }
    catch { outcome = {state:"failed"}; }
    const finishedAt = deps.now();
    if (!validTime(finishedAt) || finishedAt >= lease.expiresAt) {
      records.push({id,state:"lease-lost"}); break;
    }
    if (signal.aborted || !outcome || !["staged","deferred","failed"].includes(outcome.state)) outcome = {state:"failed"};
    if (outcome.state !== "staged") {
      const retryAt = outcome.retryAt;
      outcome = {state:outcome.state,retryAt:Math.max(finishedAt + RETRY_MS, typeof retryAt === "number" && validTime(retryAt) ? retryAt : 0)};
    }
    try {
      if (await deps.finish(lease, outcome, finishedAt) !== true) { records.push({id,state:"lease-lost"}); break; }
    } catch { records.push({id,state:"storage-unavailable"}); break; }
    records.push({id,state:outcome.state});
  }
  return records;
}
