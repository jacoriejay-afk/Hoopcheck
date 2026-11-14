/** REELS-1 private storage path contract.
 * Do not expose raw paths to unauthenticated callers. The server alone chooses
 * a random object identifier; never accept a path or author id from a client.
 */
export const REELS_PRIVATE_VIDEO_BUCKET = "hoopfeed-private-videos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function makeReelObjectPath(userId: string, reelId: string, mimeType: string): string {
  if (!UUID.test(userId) || !UUID.test(reelId)) throw new Error("Invalid Reel owner or identifier");
  const extension = EXTENSIONS[mimeType];
  if (!extension) throw new Error("Unsupported Reel media type");
  return `reels/${userId}/${reelId}/original.${extension}`;
}

/** Reject caller-supplied object paths outside the exact assigned Reel location. */
export function matchesReelObjectPath(
  objectPath: string,
  userId: string,
  reelId: string,
  mimeType: string,
): boolean {
  try { return objectPath === makeReelObjectPath(userId, reelId, mimeType); }
  catch { return false; }
}
