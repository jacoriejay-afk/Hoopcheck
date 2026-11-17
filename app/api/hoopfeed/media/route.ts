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

  // Check every source as this viewer. A reshare copies the reference, but
  // the underlying object still belongs to the author of the original post.
  const visited = new Set<string>();
  let sourceId = postId;
  let kind: "image" | "video" | undefined;
  let media: ReturnType<typeof resolveFeedMedia> = null;
  while (true) {
    if (visited.has(sourceId) || visited.size >= 32) {
      return NextResponse.json({ error: "Post unavailable" }, { status: 404 });
    }
    visited.add(sourceId);
    const { data: post, error } = await viewer.from("feed_posts")
      .select("author_id,image_url,image_urls,video_url,shared_post_id")
      .eq("id", sourceId).eq("status", "approved").maybeSingle();
    if (error || !post) return NextResponse.json({ error: "Post unavailable" }, { status: 404 });

    const attachedKind = post.video_url === mediaUrl ? "video"
      : post.image_url === mediaUrl || (Array.isArray(post.image_urls) && post.image_urls.includes(mediaUrl)) ? "image"
      : undefined;
    if (!attachedKind || (kind && attachedKind !== kind)) {
      return NextResponse.json({ error: "Media not attached to post" }, { status: 403 });
    }
    kind = attachedKind;
    if (!post.shared_post_id) {
      media = resolveFeedMedia(mediaUrl, url, post.author_id, kind);
      break;
    }
    sourceId = post.shared_post_id;
  }
  if (!media) return NextResponse.json({ error: "Unsupported media reference" }, { status: 400 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.storage.from(media.bucket).createSignedUrl(media.path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Media unavailable" }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl, expires_in: 60 }, { headers: { "Cache-Control": "no-store" } });
}
