/** NATIVE-2 server-side media authorization decisions.
 * This is a pure policy helper, NOT an endpoint or proof of authentication.
 * Call only after verifying the JWT server-side and fetching trusted DB rows.
 */
export type Native2ServerMediaKind = "highlight" | "verification";
export type Native2MediaOperation = "upload" | "download";

export interface Native2MediaAuthorizationInput {
  kind: Native2ServerMediaKind;
  operation: Native2MediaOperation;
  authenticatedUserId: string | null;
  recordOwnerId: string;
  recordId: string;
  bucket: string;
  objectPath: string;
  requestOwnerId?: string | null;
  expiresAt?: string | null;
  now: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKETS = { highlight: "native2-highlights", verification: "native2-verification-videos" } as const;

/** Deny by default; reviewer downloads need a separate trusted authorization path. */
export function native2AuthorizeOwnerMedia(input: Native2MediaAuthorizationInput): boolean {
  const { kind, operation, authenticatedUserId, recordOwnerId, recordId, bucket, objectPath } = input;
  if (kind !== "highlight" && kind !== "verification") return false;
  if (operation !== "upload" && operation !== "download") return false;
  if (!authenticatedUserId || !UUID.test(authenticatedUserId) || !UUID.test(recordOwnerId) || !UUID.test(recordId)) return false;
  if (authenticatedUserId.toLowerCase() !== recordOwnerId.toLowerCase()) return false;
  if (bucket !== BUCKETS[kind]) return false;
  const prefix = `${recordOwnerId.toLowerCase()}/${recordId.toLowerCase()}`;
  if (objectPath !== `${prefix}.mp4` && objectPath !== `${prefix}.mov`) return false;
  if (kind === "verification") {
    if (!input.requestOwnerId || !UUID.test(input.requestOwnerId) || input.requestOwnerId.toLowerCase() !== recordOwnerId.toLowerCase()) return false;
    const now = Date.parse(input.now);
    const expiry = Date.parse(input.expiresAt ?? "");
    if (!Number.isFinite(now) || !Number.isFinite(expiry) || now >= expiry) return false;
  }
  return true;
}
