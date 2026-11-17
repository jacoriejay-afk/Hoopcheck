import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { native2AuthorizeOwnerMedia } from "../../../../lib/native2/server-media-policy";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Owner-only verification video download. No reviewer path or public URLs.
 * Disabled independently until request ownership and HTTP tests are verified.
 */
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (process.env.NATIVE2_VERIFICATION_VIDEO_DOWNLOADS_ENABLED !== "true")
    return NextResponse.json({ error: "Not available" }, { status: 404, headers });
  const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token || token.length > 8192)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey)
    return NextResponse.json({ error: "Unavailable" }, { status: 503, headers });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || !("assetId" in body) ||
      typeof body.assetId !== "string" || !UUID.test(body.assetId))
    return NextResponse.json({ error: "Invalid asset" }, { status: 400, headers });
  const userClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: authError } = await userClient.auth.getUser(token);
  if (authError || !identity.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: asset, error: assetError } = await admin.from("native2_verification_video_assets")
    .select("id,owner_id,request_id,private_storage_path,expires_at")
    .eq("id", body.assetId).eq("owner_id", identity.user.id).maybeSingle();
  if (assetError) return NextResponse.json({ error: "Unavailable" }, { status: 503, headers });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  // Never accept request owner or request ID from the caller.
  const { data: trustedRequest, error: requestError } = await admin.from("player_verification_requests")
    .select("id,user_id").eq("id", asset.request_id).eq("user_id", identity.user.id).maybeSingle();
  if (requestError) return NextResponse.json({ error: "Unavailable" }, { status: 503, headers });
  if (!trustedRequest || !native2AuthorizeOwnerMedia({
    kind: "verification", operation: "download", authenticatedUserId: identity.user.id,
    recordOwnerId: asset.owner_id, recordId: asset.id, bucket: "native2-verification-videos",
    objectPath: asset.private_storage_path, requestOwnerId: trustedRequest.user_id,
    requestId: asset.request_id, trustedRequestId: trustedRequest.id,
    expiresAt: asset.expires_at, now: new Date().toISOString(),
  })) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  const { data: signed, error: signError } = await admin.storage.from("native2-verification-videos")
    .createSignedUrl(asset.private_storage_path, 60);
  if (signError || !signed?.signedUrl)
    return NextResponse.json({ error: "Unavailable" }, { status: 503, headers });
  return NextResponse.json({ url: signed.signedUrl, expiresIn: 60 }, { headers });
}
