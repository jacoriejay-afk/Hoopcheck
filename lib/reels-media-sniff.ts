/** REELS-1: inspect a bounded prefix of uploaded bytes.
 * Content-type headers and filename extensions are untrusted.
 * This detects common containers but does not prove duration or safety.
 */
export type ReelContainer = "video/mp4" | "video/webm" | "video/quicktime";

export function detectReelContainer(bytes: Uint8Array): ReelContainer | null {
  if (bytes.length < 12) return null;
  // EBML is shared by Matroska and WebM. Require the WebM DocType
  // element (0x4282) within the bounded header; an EBML magic alone
  // is insufficient to identify a WebM file.
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    const limit = Math.min(bytes.length - 6, 4096);
    for (let i = 4; i <= limit; i++) {
      if (bytes[i] === 0x42 && bytes[i + 1] === 0x82 &&
          bytes[i + 2] === 0x84 &&
          bytes[i + 3] === 0x77 && bytes[i + 4] === 0x65 &&
          bytes[i + 5] === 0x62 && bytes[i + 6] === 0x6d)
        return "video/webm";
    }
    return null;
  }
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
