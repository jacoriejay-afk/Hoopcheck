// Private HoopFeed storage references are opaque identifiers, never public URLs.
// This module is intentionally dependency-free for server-side validation.
export const HOOPFEED_PRIVATE_BUCKETS = {
  image: "hoopfeed-private-images",
  video: "hoopfeed-private-videos",
} as const;

export type HoopFeedMediaKind = keyof typeof HOOPFEED_PRIVATE_BUCKETS;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|mp4|webm|mov)$/i;

export function parseHoopFeedPrivateMediaRef(value: unknown): { kind: HoopFeedMediaKind; bucket: string; path: string; ownerId: string } | null {
  if (typeof value !== "string" || value.length > 240 || value.includes("%") || value.includes("\\") || value.includes("?") || value.includes("#")) return null;
  const parts = value.split("/");
  if (parts.length !== 3) return null;
  const [bucket, ownerId, filename] = parts;
  const kind = Object.entries(HOOPFEED_PRIVATE_BUCKETS).find(([, name]) => name === bucket)?.[0] as HoopFeedMediaKind | undefined;
  if (!kind || !UUID.test(ownerId) || !FILE.test(filename)) return null;
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  if (kind === "image" && !["jpg", "png", "webp"].includes(ext)) return null;
  if (kind === "video" && !["mp4", "webm", "mov"].includes(ext)) return null;
  return { kind, bucket, ownerId, path: ownerId + "/" + filename };
}
