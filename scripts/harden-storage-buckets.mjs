import { pathToFileURL } from "node:url";

const images = ["image/jpeg", "image/png", "image/webp"];
const evidence = [...images, "application/pdf"];
export const limits = Object.freeze([
  { id: "fan-group-images", public: false, fileSizeLimit: 4 * 1024 ** 2, allowedMimeTypes: images },
  { id: "player-verification-documents", public: false, fileSizeLimit: 10 * 1024 ** 2, allowedMimeTypes: evidence },
  { id: "profile-claim-proofs", public: false, fileSizeLimit: 10 * 1024 ** 2, allowedMimeTypes: evidence },
  { id: "profile-avatars", public: true, fileSizeLimit: 10 * 1024 ** 2, allowedMimeTypes: images },
]);
const sameTypes = (a, b) => Array.isArray(a) && a.length === b.length &&
  [...a].sort().join(",") === [...b].sort().join(",");
function matches(bucket, spec) {
  return bucket.public === spec.public && bucket.file_size_limit === spec.fileSizeLimit &&
    sameTypes(bucket.allowed_mime_types, spec.allowedMimeTypes);
}
async function get(storage, id) {
  const { data, error } = await storage.getBucket(id);
  if (error || !data || data.id !== id) throw new Error("Could not read bucket: " + id);
  return data;
}
export async function hardenBuckets(storage, { apply = false, report = () => {} } = {}) {
  // Read every target before any mutation. Abort on unexpected tighter/custom settings.
  const planned = [];
  for (const spec of limits) {
    const bucket = await get(storage, spec.id);
    if (bucket.public !== spec.public ||
        (bucket.file_size_limit !== null && bucket.file_size_limit !== spec.fileSizeLimit) ||
        (bucket.allowed_mime_types !== null && !sameTypes(bucket.allowed_mime_types, spec.allowedMimeTypes))) {
      throw new Error("Unexpected bucket configuration; review without overwriting: " + spec.id);
    }
    planned.push({ spec, already: matches(bucket, spec) });
  }
  for (const { spec, already } of planned) {
    report({ bucket: spec.id, status: already ? "unchanged" : apply ? "applying" : "planned",
      public: spec.public, maxBytes: spec.fileSizeLimit, types: spec.allowedMimeTypes });
    if (!apply || already) continue;
    // Re-read before write; never overwrite a concurrent custom change knowingly.
    const current = await get(storage, spec.id);
    if (matches(current, spec)) continue;
    if (current.public !== spec.public ||
        (current.file_size_limit !== null && current.file_size_limit !== spec.fileSizeLimit) ||
        (current.allowed_mime_types !== null && !sameTypes(current.allowed_mime_types, spec.allowedMimeTypes))) {
      throw new Error("Concurrent configuration change: " + spec.id);
    }
    const { error } = await storage.updateBucket(spec.id, {
      public: spec.public, fileSizeLimit: spec.fileSizeLimit, allowedMimeTypes: spec.allowedMimeTypes,
    });
    if (error) throw new Error("Storage API rejected update: " + spec.id);
    if (!matches(await get(storage, spec.id), spec)) throw new Error("Verification failed: " + spec.id);
    report({ bucket: spec.id, status: "verified" });
  }
  return planned.length;
}
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url !== "https://ucbdceaieyenljcwlhnj.supabase.co") throw new Error("Incorrect production target");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Production Storage credential unavailable");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const apply = process.env.HOOPCHECK_STORAGE_LIMITS_APPROVED === "YES";
  await hardenBuckets(client.storage, { apply, report: row => console.log(JSON.stringify(row)) });
  console.log(apply ? "Storage settings verified." : "Dry run only; no settings changed.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
