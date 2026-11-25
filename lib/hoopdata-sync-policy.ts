// Pure planning only. The executor must reserve durable quota before every request.
export type SyncPool = "api-sports-basketball" | "balldontlie";
export type SyncKind = "live" | "schedule" | "standings" | "seasons";
export type SyncJob = {
  id: string; pool: SyncPool; kind: SyncKind; approved: boolean;
  lastAttemptAt: number | null; retryAt: number | null;
  inFlight: boolean;
};
export type PoolSnapshot = {
  enabled: boolean; minuteRemaining: number; dayRemaining: number;
  blockedUntil: number | null;
};
export type SyncPlan = {
  selected: string[];
  deferred: {id: string; reason: "invalid"|"unapproved"|"duplicate"|"in-flight"|"cooldown"|"not-due"|"quota"|"batch-limit"}[];
};
const cadence: Record<SyncKind, number> = {
  live: 60_000, schedule: 15 * 60_000, standings: 60 * 60_000, seasons: 24 * 60 * 60_000,
};
const priority: Record<SyncKind, number> = {live: 0, schedule: 1, standings: 2, seasons: 3};
const timestamp = (value: number | null) => value === null || (Number.isSafeInteger(value) && value >= 0);
const count = (value: number) => Number.isSafeInteger(value) && value >= 0;
/** Timestamps are UTC epoch milliseconds. Quota snapshots are advisory, not reservations.
 * Only explicit approved jobs are eligible. A live job must represent a currently
 * active fixture/query selected by the caller, not an inferred game lifecycle.
 * No provider calls, canonical writes, or scheduling side effects occur here.
 */
export function planBasketballSync(jobs: readonly SyncJob[], pools: Partial<Record<SyncPool, PoolSnapshot>>, now: number, maxJobs = 4): SyncPlan {
  if (!count(now) || !count(maxJobs) || maxJobs > 20) throw Error("Invalid planning bounds");
  const selected: string[] = [], deferred: SyncPlan["deferred"] = [];
  const counts = new Map<string, number>();
  for (const job of jobs) counts.set(job.id, (counts.get(job.id) ?? 0) + 1);
  const remaining = new Map<SyncPool, number>();
  for (const pool of ["api-sports-basketball", "balldontlie"] as const) {
    const q = pools[pool];
    if (q?.enabled === true && count(q.minuteRemaining) && count(q.dayRemaining) &&
      timestamp(q.blockedUntil) && (q.blockedUntil === null || q.blockedUntil <= now)) {
      remaining.set(pool, Math.min(q.minuteRemaining, q.dayRemaining));
    }
  }
  const eligible: SyncJob[] = [];
  for (const job of jobs) {
    const reject = (reason: SyncPlan["deferred"][number]["reason"]) => deferred.push({id: job.id, reason});
    if (typeof job.id !== "string" || !job.id.trim() || !Object.hasOwn(cadence, job.kind) ||
        (job.pool !== "api-sports-basketball" && job.pool !== "balldontlie") ||
        !timestamp(job.lastAttemptAt) || !timestamp(job.retryAt) ||
        (job.lastAttemptAt !== null && job.lastAttemptAt > now) || typeof job.inFlight !== "boolean") { reject("invalid"); continue; }
    if ((counts.get(job.id) ?? 0) > 1) { reject("duplicate"); continue; }
    if (job.approved !== true) { reject("unapproved"); continue; }
    if (job.inFlight) { reject("in-flight"); continue; }
    if (job.retryAt !== null && job.retryAt > now) { reject("cooldown"); continue; }
    const q = pools[job.pool];
    if (q && q.blockedUntil !== null && q.blockedUntil > now) { reject("cooldown"); continue; }
    if (job.lastAttemptAt !== null && now - job.lastAttemptAt < cadence[job.kind]) { reject("not-due"); continue; }
    eligible.push(job);
  }
  eligible.sort((a,b) => priority[a.kind] - priority[b.kind] ||
    (a.lastAttemptAt ?? -1) - (b.lastAttemptAt ?? -1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const job of eligible) {
    const available = remaining.get(job.pool) ?? 0;
    if (available <= 0) { deferred.push({id:job.id,reason:"quota"}); continue; }
    if (selected.length >= maxJobs) { deferred.push({id:job.id,reason:"batch-limit"}); continue; }
    selected.push(job.id);
    remaining.set(job.pool, available - 1);
  }
  return {selected,deferred};
}
