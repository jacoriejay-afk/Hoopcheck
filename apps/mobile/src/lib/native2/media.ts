/** NATIVE-2 private media path contracts. Server-side authorization is still required. */
export type Native2MediaKind = "highlight" | "verification";
export const NATIVE2_MEDIA_BUCKETS = {
  highlight: "native2-highlights",
  verification: "native2-verification-videos",
} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** No user-supplied path fragments: generate opaque paths on the trusted server. */
export function native2MediaObjectPath(ownerId: string, assetId: string, extension: "mp4" | "mov"): string {
  if (!UUID.test(ownerId) || !UUID.test(assetId)) throw new Error("Invalid media identity");
  return `${ownerId.toLowerCase()}/${assetId.toLowerCase()}.${extension}`;
}

/** Defense in depth: validate identity, bucket and object key before signing access. */
export function native2CanAccessMedia(
  kind: Native2MediaKind,
  bucket: string,
  path: string,
  authenticatedUserId: string,
  recordOwnerId: string,
  assetId: string,
  isAuthorizedReviewer = false,
): boolean {
  if (!UUID.test(authenticatedUserId) || !UUID.test(recordOwnerId) || !UUID.test(assetId)) return false;
  if (bucket !== NATIVE2_MEDIA_BUCKETS[kind]) return false;
  if (isAuthorizedReviewer && kind === "verification") return (
    path === native2MediaObjectPath(recordOwnerId, assetId, "mp4") ||
    path === native2MediaObjectPath(recordOwnerId, assetId, "mov")
  );
  if (authenticatedUserId.toLowerCase() !== recordOwnerId.toLowerCase()) return false;
  return path === native2MediaObjectPath(recordOwnerId, assetId, "mp4") ||
    path === native2MediaObjectPath(recordOwnerId, assetId, "mov");
}
