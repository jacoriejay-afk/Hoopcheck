import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseHoopFeedPrivateMediaRef } from "../../../../lib/hoopfeed-private-media-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately author-only until the follower/global audience policy and RLS
// migration have been verified. Never treat this endpoint as rollout-ready.
export async function POST(request: Request) {
  const deny = (status: number) => NextResponse.json({ error: "Media unavailable." }, { status, headers: { "Cache-Control": "no-store" } });
  const bearer = request.headers.get("authorization")?.match(/^Bearer\\s+(\\S+)$/i)?.[1];
  if (!bearer) return deny(401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return deny(503);
  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return deny(400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); return deny(413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return deny(400); }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const ref = parseHoopFeedPrivateMediaRef(input.ref);
  const postId = input.post_id;
  if (!ref || typeof postId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId)) return deny(400);
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: auth, error: authError } = await db.auth.getUser(bearer);
  if (authError || !auth.user) return deny(401);
  if (ref.ownerId !== auth.user.id) return deny(404);
  const { data: post, error: postError } = await db.from("feed_posts")
    .select("author_id,status,expires_at,image_url,image_urls,video_url")
    .eq("id", postId).eq("author_id", auth.user.id).maybeSingle();
  if (postError || !post || post.status !== "approved" || !post.expires_at || Date.parse(post.expires_at) <= Date.now()) return deny(404);
  const references = [post.image_url, post.video_url, ...(Array.isArray(post.image_urls) ? post.image_urls : [])];
  if (!references.includes(input.ref)) return deny(404);
  const { data: signed, error: signError } = await db.storage.from(ref.bucket).createSignedUrl(ref.path, 60);
  if (signError || !signed?.signedUrl) return deny(404);
  return NextResponse.json({ url: signed.signedUrl, expires_in: 60 }, { headers: { "Cache-Control": "no-store" } });
}
