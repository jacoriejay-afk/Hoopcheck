/** REELS-1: inspect a bounded prefix of uploaded bytes.
 * Content-type headers and filename extensions are untrusted.
 * This detects common containers but does not prove duration or safety.
 */
export type ReelContainer = "video/mp4" | "video/webm" | "video/quicktime";

export function detectReelContainer(bytes: Uint8Array): ReelContainer | null {
  if (bytes.length < 12) return null;
  // EBML header (WebM); further decoder validation is still required.
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3)
    return "video/webm";
  const brand = String.fromCharCode(...bytes.subarray(8, 12));
  const box = String.fromCharCode(...bytes.subarray(4, 8));
  if (box !== "ftyp") return null;
  const majorBrands = new Set(["qt  "]);
  if (majorBrands.has(brand)) return "video/quicktime";
  if (["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash", "MSNV"].includes(brand))
    return "video/mp4";
  return null;
}

export function matchesReelContainer(bytes: Uint8Array, claimedMime: string): boolean {
  return detectReelContainer(bytes) === claimedMime;
}
