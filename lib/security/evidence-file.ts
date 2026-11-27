// Client-side defense in depth; storage-side restrictions and malware scanning are separate.
export type EvidenceFile = Pick<Blob, "size" | "type" | "slice">;
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
export async function inspectEvidenceFile(file: EvidenceFile): Promise<{ mime: string; extension: string } | null> {
  if (file.size < 12 || file.size > MAX_EVIDENCE_BYTES) return null;
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const starts = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));
  const detected = starts([0x25,0x50,0x44,0x46,0x2d]) ? { mime: "application/pdf", extension: "pdf" }
    : starts([0xff,0xd8,0xff]) ? { mime: "image/jpeg", extension: "jpg" }
    : starts([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]) ? { mime: "image/png", extension: "png" }
    : ascii(0,4) === "RIFF" && ascii(8,4) === "WEBP" ? { mime: "image/webp", extension: "webp" }
    : null;
  if (!detected) return null;
  const declared = file.type.toLowerCase();
  return !declared || declared === "application/octet-stream" || declared === detected.mime ? detected : null;
}
