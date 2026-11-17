import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { native2AuthorizeOwnerMedia } from "../../../../lib/native2/server-media-policy";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * NATIVE-2 highlight owner download: disabled until server rollout approval.
 * Verification video access intentionally excluded pending trusted request ownership
 * and reviewer authorization integration. Never return service-role credentials.
 */
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (process.env.NATIVE2_MEDIA_DOWNLOADS_ENABLED !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 404, headers });
  }
  const bearer = request.headers.get("authorization") ?? "";
  const token = /^Bearer ([^\s]+)$/i.exec(bearer)?.[1];
  if (!token || token.length > 8192) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey) return NextResponse.json({ error: "Unavailable" }, { status: 503, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || !("assetId" in body) || typeof body.assetId !== "string" || !UUID.test(body.assetId)) {
    return NextResponse.json({ error: "Invalid asset" }, { status: 400, headers });
  }
  const userClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: authError } = await userClient.auth.getUser(token);
  if (authError || !identity.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: asset, error } = await admin.from("native2_highlight_assets")
    .select("id,owner_id,private_storage_path,status")
    .eq("id", body.assetId).eq("owner_id", identity.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Unavailable" }, { status: 503, headers });
  if (!asset || asset.status !== "ready" || !native2AuthorizeOwnerMedia({
    kind: "highlight", operation: "download", authenticatedUserId: identity.user.id,
    recordOwnerId: asset.owner_id, recordId: asset.id, bucket: "native2-highlights",
    objectPath: asset.private_storage_path, now: new Date().toISOString(),
  })) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  const { data: signed, error: signError } = await admin.storage.from("native2-highlights")
    .createSignedUrl(asset.private_storage_path, 60);
  if (signError || !signed?.signedUrl) return NextResponse.json({ error: "Unavailable" }, { status: 503, headers });
  return NextResponse.json({ url: signed.signedUrl, expiresIn: 60 }, { headers });
}
