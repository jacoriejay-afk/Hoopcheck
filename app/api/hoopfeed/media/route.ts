import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { feedMediaId, resolveFeedMedia } from "../../../../lib/feed-media-reference";

export const runtime = "nodejs";

/**
 * Issue short-lived media links only when the caller can read the exact post
 * through feed_posts RLS. Never accept arbitrary bucket/path signing requests.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey) {
    return NextResponse.json({ error: "Media temporarily unavailable" }, { status: 503 });
  }

  let payload: { post_id?: unknown; media_url?: unknown };
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const postId = typeof payload.post_id === "string" ? payload.post_id : "";
  const mediaUrl = typeof payload.media_url === "string" ? payload.media_url : "";
  if (!feedMediaId.test(postId) || !mediaUrl || mediaUrl.length > 2048) {
    return NextResponse.json({ error: "Invalid media reference" }, { status: 400 });
  }

  const viewer = createClient(url, publicKey, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: identity, error: identityError } = await viewer.auth.getUser(token);
  if (identityError || !identity.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  // RLS must enforce the viewer's role and membership. Posts remain permanent.
  const { data: post, error: postError } = await viewer.from("feed_posts")
    .select("author_id,image_url,image_urls,video_url,shared_post_id")
    .eq("id", postId).eq("status", "approved").maybeSingle();
  if (postError || !post) return NextResponse.json({ error: "Post unavailable" }, { status: 404 });

  // Reshares may reach a different follower audience. Never sign copied private
  // media unless the viewer can also read the original post through its RLS.
  let mediaOwnerId = post.author_id;
  if (post.shared_post_id) {
    const { data: original, error: originalError } = await viewer.from("feed_posts")
      .select("id,author_id,image_url,image_urls,video_url")
      .eq("id", post.shared_post_id).eq("status", "approved").maybeSingle();
    if (originalError || !original) return NextResponse.json({ error: "Original post unavailable" }, { status: 404 });
    mediaOwnerId = original.author_id;
    const originalRefs = [original.image_url, original.video_url, ...(Array.isArray(original.image_urls) ? original.image_urls : [])];
    if (!originalRefs.includes(mediaUrl)) return NextResponse.json({ error: "Media not attached to original" }, { status: 403 });
  }
  const references = [post.image_url, post.video_url, ...(Array.isArray(post.image_urls) ? post.image_urls : [])];
  if (!references.includes(mediaUrl)) return NextResponse.json({ error: "Media not attached to post" }, { status: 403 });

  const kind = mediaUrl === post.video_url ? "video" : "image";
  const media = resolveFeedMedia(mediaUrl, url, mediaOwnerId, kind);
  if (!media) return NextResponse.json({ error: "Unsupported media reference" }, { status: 400 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.storage.from(media.bucket).createSignedUrl(media.path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Media unavailable" }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl, expires_in: 60 }, { headers: { "Cache-Control": "no-store" } });
}
