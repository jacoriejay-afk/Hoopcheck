import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { expiringFeedMediaTtl, feedMediaId, resolveFeedMedia } from "../../../../lib/feed-media-reference";

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
  let earliestExpiry = Number.POSITIVE_INFINITY;
  while (true) {
    if (visited.has(sourceId) || visited.size >= 32) {
      return NextResponse.json({ error: "Post unavailable" }, { status: 404 });
    }
    visited.add(sourceId);
    const { data: post, error } = await viewer.from("feed_posts")
      .select("author_id,image_url,image_urls,video_url,shared_post_id,expires_at,post_kind")
      .eq("id", sourceId).eq("status", "approved").maybeSingle();
    if (error || !post) return NextResponse.json({ error: "Post unavailable" }, { status: 404 });
    if (post.expires_at !== null) {
      const expiry = typeof post.expires_at === "string" ? Date.parse(post.expires_at) : NaN;
      if (!Number.isFinite(expiry) || expiry <= Date.now()) return NextResponse.json({ error: "Post unavailable" }, { status: 404 });
      earliestExpiry = Math.min(earliestExpiry, expiry);
    }

    const attachedKind = post.video_url === mediaUrl ? "video"
      : post.image_url === mediaUrl || (Array.isArray(post.image_urls) && post.image_urls.includes(mediaUrl)) ? "image"
      : undefined;
    if (!attachedKind || (kind && attachedKind !== kind)) {
      return NextResponse.json({ error: "Media not attached to post" }, { status: 403 });
    }
    // Never sign a video Story on the strength of row approval alone,
    // including when the attachment is reached through a source chain.
    if (post.post_kind === "story" && attachedKind === "video") {
      if(process.env.HOOPCHECK_REVIEWED_VIDEO_STORIES_ENABLED!=="true"||visited.size!==1||post.shared_post_id||!mediaUrl.startsWith("hoopfeed-private-videos/story-processed/"))return NextResponse.json({ error:"Video Stories are unavailable" }, {status:404});
      const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
      const args={p_post:postId,p_ref:mediaUrl};
      const verified=await viewer.rpc("confirm_active_account_session");
      if(verified.error||verified.data!==true)return NextResponse.json({error:"Media unavailable"},{status:404});
      const receipt=await admin.rpc("resolve_reviewed_story_video",args);
      const asset=receipt.data;
      const path=mediaUrl.slice("hoopfeed-private-videos/".length);
      const expiry=typeof asset?.expires_at==="string"?Date.parse(asset.expires_at):NaN;
      if(receipt.error||!asset||asset.path!==path||!/^story-processed\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/video\.mp4$/i.test(path)||!Number.isFinite(expiry)||expiry!==earliestExpiry)return NextResponse.json({error:"Media unavailable"},{status:404});
      const bucket=await admin.storage.getBucket("hoopfeed-private-videos");
      if(bucket.error||bucket.data?.public!==false)return NextResponse.json({error:"Media unavailable"},{status:404});
      const ttl=expiringFeedMediaTtl(expiry);
      if(ttl<1)return NextResponse.json({error:"Media unavailable"},{status:404});
      const signed=await admin.storage.from("hoopfeed-private-videos").createSignedUrl(path,ttl);
      const after=await admin.rpc("resolve_reviewed_story_video",args);
      const current=await viewer.from("feed_posts").select("id,video_url,expires_at,post_kind").eq("id",postId).eq("status","approved").maybeSingle();
      const active=await viewer.rpc("confirm_active_account_session");
      if(signed.error||!signed.data?.signedUrl||after.error||JSON.stringify(after.data)!==JSON.stringify(asset)||current.error||current.data?.id!==postId||current.data?.video_url!==mediaUrl||current.data?.post_kind!=="story"||Date.parse(current.data?.expires_at||"")!==expiry||active.error||active.data!==true||Date.now()+ttl*1000>expiry)return NextResponse.json({error:"Media unavailable"},{status:404});
      return NextResponse.json({url:signed.data.signedUrl,expires_in:ttl},{headers:{"Cache-Control":"no-store"}});
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
  // Do not issue a full-minute link for a post or ancestor about to expire.
  // Leave a conservative margin for signing latency and decline late responses.
  const ttl = expiringFeedMediaTtl(earliestExpiry);
  if (ttl < 1) return NextResponse.json({ error: "Post unavailable" }, { status: 404 });
  const { data, error } = await admin.storage.from(media.bucket).createSignedUrl(media.path, ttl);
  if (error || !data?.signedUrl || Date.now() + ttl * 1000 > earliestExpiry) return NextResponse.json({ error: "Media unavailable" }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl, expires_in: ttl }, { headers: { "Cache-Control": "no-store" } });
}
