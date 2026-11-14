import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getHoopCheckEntitlements } from "../../../../lib/membership-tier";
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const viewer = createClient(url, key, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: identity, error: authError } = await viewer.auth.getUser(token);
  if (authError || !identity.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const [{ data: profile, error: profileError }, { data: subscription, error: subscriptionError }] = await Promise.all([
    viewer.from("profiles").select("account_type,moderation_status").eq("id", identity.user.id).maybeSingle(),
    viewer.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", identity.user.id).maybeSingle(),
  ]);
  if (profileError || subscriptionError) return NextResponse.json({ error: "Unable to verify membership" }, { status: 503 });
  if (!profile || profile.moderation_status === "suspended") return NextResponse.json({ error: "Account not eligible" }, { status: 403 });
  if (!getHoopCheckEntitlements({ accountType: profile.account_type, subscription }).canWriteHoopFeed)
    return NextResponse.json({ error: "Active HoopFeed membership required" }, { status: 403 });

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
  const tag = data.tag == null ? null : data.tag;
  if (tag !== null && (typeof tag !== "object" || Array.isArray(tag)))
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  const tagData = tag as { type?: unknown; id?: unknown } | null;
  if (tagData && (typeof tagData.type !== "string" || typeof tagData.id !== "string"))
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  const validationError = validateReelInput({
    mimeType: data.mimeType, bytes: data.bytes, durationSeconds: data.durationSeconds,
    caption: data.caption, tag: tagData as Parameters<typeof validateReelInput>[0]["tag"],
  });
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  return NextResponse.json({ eligible: true, uploadEnabled: false }, { headers: { "Cache-Control": "no-store" } });
}
