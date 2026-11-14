import { NextResponse } from "next/server";
import { authorizeReelPublisher } from "../../../../lib/reels-publisher-auth";
import { validateReelInput } from "../../../../lib/reels-validation";

export const runtime = "nodejs";
const MAX_PREFLIGHT_BYTES = 4096;

/**
 * REELS-1 preflight: validates identity, the existing paid HoopFeed gate,
 * metadata limits and tag shape. It NEVER uploads or signs media.
 * The actual upload endpoint must independently verify bytes, duration,
 * authorization and private storage ownership before creating a reel.
 */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const authorization = await authorizeReelPublisher(token);
  if (!authorization.ok)
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });

  // A preflight needs only a few metadata fields. Do not buffer unbounded bodies.
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(declaredLength) || declaredLength > MAX_PREFLIGHT_BYTES)
    return NextResponse.json({ error: "Metadata too large" }, { status: 413 });
  let payload: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PREFLIGHT_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "Metadata too large" }, { status: 413 });
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
  const data = payload as Record<string, unknown>;
  if (typeof data.mimeType !== "string" || typeof data.bytes !== "number" ||
      typeof data.durationSeconds !== "number" || typeof data.caption !== "string")
    return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
  // Reject ambiguous or unexpected fields instead of silently ignoring them.
  const allowedFields = new Set(["mimeType", "bytes", "durationSeconds", "caption", "tag"]);
  if (Object.keys(data).some((field) => !allowedFields.has(field)))
    return NextResponse.json({ error: "Unexpected metadata field" }, { status: 400 });
  const tag = data.tag == null ? null : data.tag;
  if (tag !== null && (typeof tag !== "object" || Array.isArray(tag)))
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  const tagData = tag as { type?: unknown; id?: unknown } | null;
  if (tagData && (Object.keys(tagData).some((field) => !["type", "id"].includes(field)) ||
    typeof tagData.type !== "string" || typeof tagData.id !== "string"))
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  const validationError = validateReelInput({
    mimeType: data.mimeType, bytes: data.bytes, durationSeconds: data.durationSeconds,
    caption: data.caption, tag: tagData as Parameters<typeof validateReelInput>[0]["tag"],
  });
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  return NextResponse.json({ eligible: true, uploadEnabled: false }, { headers: { "Cache-Control": "no-store" } });
}
