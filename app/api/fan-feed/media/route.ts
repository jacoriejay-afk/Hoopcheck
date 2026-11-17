import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { feedMediaId, resolveFeedMedia } from "../../../../lib/feed-media-reference";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey) return NextResponse.json({ error: "Media unavailable" }, { status: 503 });
  const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const payload = await request.json().catch(() => null);
  const postId = typeof payload?.post_id === "string" ? payload.post_id : "";
  if (!feedMediaId.test(postId)) return NextResponse.json({ error: "Invalid post" }, { status: 400 });
  const viewer = createClient(url, publicKey, { global: { headers: { Authorization: "Bearer " + token } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: identity, error: authError } = await viewer.auth.getUser(token);
  if (authError || !identity.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  const kind = payload?.kind ?? "image";
  if (kind !== "image" && kind !== "video") return NextResponse.json({ error: "Invalid media type" }, { status: 400 });

  const { data: post, error: postError } = await viewer.from("fan_feed_posts")
    .select("image_url,video_url,author_id").eq("id", postId).eq("status", "approved").gt("expires_at", new Date().toISOString()).maybeSingle();
  if (postError || !post) return NextResponse.json({ error: "Post unavailable" }, { status: 404 });

  const media = resolveFeedMedia((kind === "image" ? post.image_url : post.video_url) ?? "", url, post.author_id, kind);
  if (!media) return NextResponse.json({ error: "Unsupported media" }, { status: 404 });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.storage.from(media.bucket).createSignedUrl(media.path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Media unavailable" }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl }, { headers: { "Cache-Control": "no-store" } });
}
