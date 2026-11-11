import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const PRIVATE_BUCKETS = new Set(["hoopfeed-private-images", "hoopfeed-private-videos"]);

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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId) || !mediaUrl || mediaUrl.length > 2048) {
    return NextResponse.json({ error: "Invalid media reference" }, { status: 400 });
  }

  const viewer = createClient(url, publicKey, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: identity, error: identityError } = await viewer.auth.getUser(token);
  if (identityError || !identity.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  // RLS must enforce the viewer's role, membership, follow and expiry rules.
  const { data: post, error: postError } = await viewer.from("feed_posts")
    .select("image_url,image_urls,video_url")
    .eq("id", postId).eq("status", "approved")
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  if (postError || !post) return NextResponse.json({ error: "Post unavailable" }, { status: 404 });

  const references = [post.image_url, post.video_url, ...(Array.isArray(post.image_urls) ? post.image_urls : [])];
  if (!references.includes(mediaUrl)) return NextResponse.json({ error: "Media not attached to post" }, { status: 403 });

  // Stored private references use "bucket/path", never a user-supplied URL.
  if (mediaUrl.includes("?") || mediaUrl.includes("#") || mediaUrl.includes("\\") || /%2f|%5c|%2e/i.test(mediaUrl)) {\n    return NextResponse.json({ error: "Invalid media reference" }, { status: 400 });\n  }\n  const separator = mediaUrl.indexOf("/");
  const bucket = mediaUrl.slice(0, separator);
  const path = mediaUrl.slice(separator + 1);
  if (separator < 1 || !PRIVATE_BUCKETS.has(bucket) || !path || path.includes("..") || path.startsWith("/")) {
    return NextResponse.json({ error: "Unsupported media reference" }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Media unavailable" }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl, expires_in: 60 }, { headers: { "Cache-Control": "no-store" } });
}
