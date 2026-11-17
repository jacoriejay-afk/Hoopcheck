const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const feedMediaId = new RegExp("^" + uuidPattern + "$", "i");

const legacyObjectPrefix = "/storage/v1/object/public/";
const legacyBuckets = ["feed-images", "feed-videos"];
const privateBuckets = ["hoopfeed-private-images", "hoopfeed-private-videos"];

export function isProtectedFeedMedia(reference: string) {
  return [...privateBuckets, ...legacyBuckets].some(bucket =>
    reference.startsWith(bucket + "/") || reference.includes(legacyObjectPrefix + bucket + "/")
  );
}

export function resolveFeedMedia(
  reference: string,
  origin: string,
  ownerId: string,
  kind: "image" | "video",
  teamId?: string,
) {
  if (!feedMediaId.test(ownerId) || (teamId && !feedMediaId.test(teamId))) return null;

  const legacy = legacyBuckets[kind === "image" ? 0 : 1];
  const privateBucket = privateBuckets[kind === "image" ? 0 : 1];
  const legacyPrefix = new URL(legacyObjectPrefix + legacy + "/", origin).href;
  const prefixes = [
    { bucket: legacy, prefix: legacyPrefix },
    { bucket: legacy, prefix: legacy + "/" },
    { bucket: privateBucket, prefix: privateBucket + "/" },
  ];
  const match = prefixes.find(({ prefix }) => reference.startsWith(prefix));
  if (!match) return null;

  const path = reference.slice(match.prefix.length);
  const ownerPath = teamId ? "team-posts/" + teamId + "/" + ownerId : ownerId;
  if (!path.startsWith(ownerPath + "/")) return null;
  const filename = path.slice(ownerPath.length + 1);
  const extension = kind === "image" ? "(jpg|jpeg|png|webp)" : "(mp4|webm|mov)";
  if (!new RegExp("^" + uuidPattern + "[.]" + extension + "$", "i").test(filename)) return null;

  return { bucket: match.bucket, path };
}
