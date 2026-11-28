import type { SupabaseClient } from "@supabase/supabase-js";
import { removeApprovedAccountMedia } from "./account-deletion-cleanup";

type MediaPlan = Parameters<typeof removeApprovedAccountMedia>[2];
type CleanupGuards = Parameters<typeof removeApprovedAccountMedia>[3];
type CleanupJob = {
  id: string;
  ownerId: string;
  fence: string;
  policyVersion: string;
  eligibleAt: string;
  reason: "rejected" | "abandoned";
  objects: MediaPlan["objects"];
};

type CleanupRepository = {
  claim(signal: AbortSignal): Promise<CleanupJob | null>;
  assertLease(job: CleanupJob, signal: AbortSignal): Promise<void>;
  // Confirms the approved disposition, no publication, original upload
  // tickets expired and inspection/transcode/output writers are fenced.
  assertClosedForWrites(job: CleanupJob, signal: AbortSignal): Promise<void>;
  readObject(job: CleanupJob, path: string, signal: AbortSignal): ReturnType<CleanupGuards["readObject"]>;
  assertNoRemainingObjects(job: CleanupJob, signal: AbortSignal): Promise<void>;
  finish(job: CleanupJob, receipt: "media_verified", signal: AbortSignal): Promise<boolean>;
};

const bucket = "hoopfeed-private-videos";
const uuid = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
const validId = new RegExp(`^${uuid}$`);

export function createStoryVideoCleanupTick(admin: SupabaseClient, repository: CleanupRepository, enabled = false) {
  let running = false;
  return async function cleanup(signal: AbortSignal) {
    if (!enabled) return "disabled" as const;
    if (signal.aborted || running) return "busy" as const;
    running = true;
    try {
      const claimed = await repository.claim(signal);
      if (!claimed) return "idle" as const;
      const copy = structuredClone(claimed);
      const job = Object.freeze({ ...copy, objects: Object.freeze(copy.objects.map(object => Object.freeze(object))) });
      if (!validId.test(job.ownerId) || !validId.test(job.id) || !validId.test(job.fence) ||
        !["rejected", "abandoned"].includes(job.reason) || !Number.isFinite(Date.parse(job.eligibleAt)) ||
        Date.parse(job.eligibleAt) > Date.now() || !Array.isArray(job.objects) || job.objects.length > 128) {
        throw Error("Video cleanup claim unavailable.");
      }
      const source = new RegExp(`^story-quarantine/${job.ownerId}/${job.id}\\.(?:mp4|mov|webm)$`);
      const output = new RegExp(`^story-processed/${job.ownerId}/${job.id}/${uuid}/(?:video\\.mp4|thumbnail\\.jpg)$`);
      if (job.objects.some(object => object.bucket !== bucket || !object.version ||
        !(source.test(object.path) || output.test(object.path)))) throw Error("Video cleanup path unavailable.");
      const lease = { requestId: job.id, ownerId: job.ownerId, fence: job.fence, policyVersion: job.policyVersion };
      const check = async (operation: () => Promise<void>) => {
        if (signal.aborted) throw Error("Video cleanup cancelled.");
        await operation();
        if (signal.aborted) throw Error("Video cleanup cancelled.");
      };
      const result = await removeApprovedAccountMedia(admin, lease, { ...lease, objects: job.objects }, {
        assertLease: () => check(() => repository.assertLease(job, signal)),
        assertFrozen: () => check(() => repository.assertClosedForWrites(job, signal)),
        readObject: async (_lease, _bucket, path) => {
          if (signal.aborted) throw Error("Video cleanup cancelled.");
          return repository.readObject(job, path, signal);
        },
        assertNoRemainingMedia: () => check(() => repository.assertNoRemainingObjects(job, signal)),
        assertReadyForAuthDeletion: async () => { throw Error("No Auth removal in video cleanup."); },
      });
      if (result.receipt !== "media_verified") return "unconfirmed" as const;
      await check(() => repository.assertLease(job, signal));
      if (await repository.finish(job, result.receipt, signal) !== true || signal.aborted) return "unconfirmed" as const;
      return "completed" as const;
    } catch {
      return "unconfirmed" as const;
    } finally { running = false; }
  };
}
