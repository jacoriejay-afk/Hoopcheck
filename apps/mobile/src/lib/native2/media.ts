/** NATIVE-2 private media paths. This client helper never grants reviewer access. */
export type Native2MediaKind = "highlight" | "verification";
export const NATIVE2_MEDIA_BUCKETS = {
  highlight: "native2-highlights",
  verification: "native2-verification-videos",
} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Generate an opaque, normalized path. The trusted server must validate the record. */
export function native2MediaObjectPath(ownerId: string, assetId: string, extension: "mp4" | "mov"): string {
  if (!UUID.test(ownerId) || !UUID.test(assetId)) throw new Error("Invalid media identity");
  if (extension !== "mp4" && extension !== "mov") throw new Error("Invalid media extension");
  return `${ownerId.toLowerCase()}/${assetId.toLowerCase()}.${extension}`;
}

/** Owner-only preflight; never treat this as server authorization or reviewer approval. */
export function native2CanAccessMedia(
  kind: Native2MediaKind,
  bucket: string,
  path: string,
  authenticatedUserId: string,
  recordOwnerId: string,
  assetId: string,
): boolean {
  if (!UUID.test(authenticatedUserId) || !UUID.test(recordOwnerId) || !UUID.test(assetId)) return false;
  if (kind !== "highlight" && kind !== "verification") return false;
  if (bucket !== NATIVE2_MEDIA_BUCKETS[kind]) return false;
  if (authenticatedUserId.toLowerCase() !== recordOwnerId.toLowerCase()) return false;
  return path === native2MediaObjectPath(recordOwnerId, assetId, "mp4") ||
    path === native2MediaObjectPath(recordOwnerId, assetId, "mov");
}
