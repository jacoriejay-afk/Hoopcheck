import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getHoopCheckEntitlements } from "../../../../lib/membership-tier";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 10 * 1024 * 1024;

async function readLimitedBody(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
const MAX_TEXT_LENGTH = 2000;
const ALLOWED_TOPIC_TAGS = new Set(["Practice","Game Day","Travel","Teammates","Culture","Win","Challenge"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PROFANITY = /\b(?:fuck|fucking|fucked|shit|bullshit|bitch|asshole|motherfucker|cunt|nigger|nigga|faggot|slut|whore)\b/i;

function blockedByLocalRules(text: string) {
  return PROFANITY.test(text);
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing server Supabase configuration.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function moderate(text: string, image: File | null) {
  // Apply deterministic checks even when the external moderation provider is unavailable.
  // This never allows content through without the required AI moderation result.
  if (blockedByLocalRules(text)) {
    return { allowed: false, status: 400, message: "Please remove profanity or abusive language before posting." };
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error("HoopFeed moderation is unavailable: OPENAI_API_KEY is not configured for this deployment.");
    return { allowed: false, status: 503, message: "HoopFeed safety moderation is temporarily unavailable. Your content was not published. Please try again shortly." };
  }

  const input: any[] = [];
  if (text) input.push({ type: "text", text });
  if (image) {
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) return { allowed: false, status: 400, message: "Use a JPEG, PNG, or WebP image." };
    if (image.size > 8 * 1024 * 1024) return { allowed: false, status: 413, message: "Image must be 8 MB or smaller." };
    const bytes = Buffer.from(await image.arrayBuffer());
    input.push({ type: "image_url", image_url: { url: "data:" + image.type + ";base64," + bytes.toString("base64") } });
  }
  if (!input.length) return { allowed: false, status: 400, message: "Add text or a photo before posting." };

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input }),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("HoopFeed moderation provider request failed:", error);
    return { allowed: false, status: 502, message: "Safety moderation is temporarily unavailable. Your content was not published." };
  }
  if (!response.ok) {
    // Avoid logging provider response bodies or credentials; only log the status.
    console.error("HoopFeed moderation provider returned HTTP", response.status);
    return { allowed: false, status: 502, message: "Safety moderation is temporarily unavailable. Your content was not published." };
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    return { allowed: false, status: 502, message: "Safety moderation returned an invalid response. Your content was not published." };
  }
  const result = data?.results?.[0];
  // Fail closed if the provider response does not explicitly include a boolean decision.
  if (!result || typeof result.flagged !== "boolean") {
    console.error("HoopFeed moderation provider response did not contain a valid decision.");
    return { allowed: false, status: 502, message: "Safety moderation returned no valid result. Your content was not published." };
  }
  if (result.flagged) return { allowed: false, status: 400, message: "This content was blocked by HoopFeed safety moderation. Remove sexual/nude, violent, hateful, abusive, or otherwise prohibited content and try again." };
  return { allowed: true, status: 200, message: "ok" };
}

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ allowed: false, message: "Request body is too large." }, { status: 413 });
    }

    const auth = request.headers.get("authorization") || "";
    const token = auth.match(/^Bearer\s+(\S+)$/i)?.[1] || "";
    if (!token) return NextResponse.json({ allowed: false, message: "Sign in is required." }, { status: 401 });

    const db = adminClient();
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ allowed: false, message: "Your session is invalid. Please sign in again." }, { status: 401 });
    const user = userData.user;

    const bodyBytes = await readLimitedBody(request, MAX_REQUEST_BYTES);
    if (bodyBytes === null) {
      return NextResponse.json({ allowed: false, message: "Request body is too large." }, { status: 413 });
    }
    // Copy into a standalone ArrayBuffer so TypeScript's BodyInit types accept it.
    const formBody = new ArrayBuffer(bodyBytes.byteLength);
    new Uint8Array(formBody).set(bodyBytes);
    const formRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: formBody,
    });
    const form = await formRequest.formData();
    const kind = String(form.get("kind") || "post");
    if (kind !== "post" && kind !== "comment" && kind !== "share" && kind !== "vote" && kind !== "bookmark" && kind !== "pin") {
      return NextResponse.json({ allowed: false, message: "Unsupported content type." }, { status: 400 });
    }
    const text = String(form.get("text") || "").trim();
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ allowed: false, message: "Text must be 2,000 characters or fewer." }, { status: 413 });
    }
    const imageValue = form.get("image");
    const image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;
    const extraImages = form.getAll("images").filter((v): v is File => v instanceof File && v.size > 0);
    const submittedImages: File[] = [...(image ? [image] : []), ...extraImages];
    if (submittedImages.length > 4) {
      return NextResponse.json({ allowed: false, message: "Add no more than 4 photos per post." }, { status: 400 });
    }
    const allImages = submittedImages;
    for (const f of extraImages) {
      if (!ALLOWED_IMAGE_TYPES.has(f.type)) {
        return NextResponse.json({ allowed: false, message: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
      }
      if (f.size > 8 * 1024 * 1024) {
        return NextResponse.json({ allowed: false, message: "Image must be 8 MB or smaller." }, { status: 413 });
      }
    }
    const videoPath = String(form.get("video_path") || "");
    const videoType = String(form.get("video_type") || "");
    if (image && !ALLOWED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json({ allowed: false, message: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
    }
    if (videoPath && (!ALLOWED_VIDEO_TYPES.has(videoType) || !videoPath.startsWith(user.id + "/") || videoPath.includes("..") || videoPath.length > 240)) return NextResponse.json({ allowed:false, message:"Invalid video upload. Choose a supported video and try again." }, { status:400 });
    if (videoPath && !text) return NextResponse.json({ allowed:false, message:"Add a caption so HoopCheck can run text safety checks before publishing a video." }, { status:400 });
    if (kind === "comment" && (allImages.length > 0 || videoPath)) {
      return NextResponse.json({ allowed: false, message: "Photos and videos can only be added to posts." }, { status: 400 });
    }

    const { data: profile } = await db.from("profiles").select("account_type,current_country,current_country_public").eq("id", user.id).maybeSingle();
    if (!profile) return NextResponse.json({ allowed: false, message: "Your account profile could not be found." }, { status: 403 });
    const submittedTopicTag = String(form.get("topic_tag") || "").trim();
    const gameDayTeam = String(form.get("game_day_team") || "").trim().slice(0, 80);
    const gameDayOpponent = String(form.get("game_day_opponent") || "").trim().slice(0, 80);
    const scoreForRaw = String(form.get("game_day_score_for") || "").trim();
    const scoreAgainstRaw = String(form.get("game_day_score_against") || "").trim();
    const scoreFor = scoreForRaw === "" ? null : Number(scoreForRaw);
    const scoreAgainst = scoreAgainstRaw === "" ? null : Number(scoreAgainstRaw);
    if (kind === "post" && submittedTopicTag && !ALLOWED_TOPIC_TAGS.has(submittedTopicTag)) {
      return NextResponse.json({ allowed: false, message: "Choose a valid HoopFeed topic." }, { status: 400 });
    }
    if (kind === "post" && submittedTopicTag === "Game Day") {
      const scoresValid = (scoreFor === null && scoreAgainst === null) || (Number.isInteger(scoreFor) && Number.isInteger(scoreAgainst) && scoreFor! >= 0 && scoreFor! <= 300 && scoreAgainst! >= 0 && scoreAgainst! <= 300);
      if (!gameDayTeam || !gameDayOpponent || !scoresValid) return NextResponse.json({ allowed: false, message: "Add both teams and enter both final scores, or leave both scores blank until after the game." }, { status: 400 });
    }
    const { data: sub } = await db.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", user.id).maybeSingle();
    const { data: adminRoleRows } = await db.from("admin_roles").select("role").eq("user_id", user.id);
    const isAdmin = (adminRoleRows || []).some((r: any) => String(r?.role || "").trim().toLowerCase() === "admin");
    const entitlements = getHoopCheckEntitlements({ accountType: profile?.account_type, subscription: sub, isAdmin });
    if (!entitlements.canWriteHoopFeed) return NextResponse.json({ allowed: false, message: "An active Pro or Premium membership is required to use HoopFeed." }, { status: 403 });

    // Poll vote: one vote per member per poll; voting again changes the vote.
    if (kind === "vote") {
      const postId = String(form.get("post_id") || "").trim();
      const rawOptionIndex = form.get("option_index");
      const optionIndex = rawOptionIndex === null || String(rawOptionIndex).trim() === "" ? NaN : Number(rawOptionIndex);
      if (!postId || !Number.isInteger(optionIndex)) return NextResponse.json({ allowed: false, message: "That vote didn't go through. Please try again." }, { status: 400 });
      const { data: poll } = await db.from("feed_posts").select("id,status,post_kind,poll_options,expires_at").eq("id", postId).maybeSingle();
      const options = Array.isArray(poll?.poll_options) ? poll.poll_options as string[] : [];
      if (!poll || poll.status !== "approved" || (poll.expires_at && new Date(poll.expires_at).getTime() <= Date.now()) || poll.post_kind !== "poll" || optionIndex < 0 || optionIndex >= options.length) {
        return NextResponse.json({ allowed: false, message: "This poll is no longer available." }, { status: 404 });
      }
      const { error } = await db.from("feed_poll_votes").upsert({ post_id: postId, user_id: user.id, option_index: optionIndex }, { onConflict: "post_id,user_id" });
      if (error) return NextResponse.json({ allowed: false, message: "That vote didn't go through. Please try again." }, { status: 400 });
      return NextResponse.json({ allowed: true });
    }

    // Save / unsave a post (bookmark).
    if (kind === "bookmark") {
      const postId = String(form.get("post_id") || "").trim();
      const saved = String(form.get("saved") || "") === "true";
      if (!postId) return NextResponse.json({ allowed: false, message: "Couldn't update your saved posts. Please try again." }, { status: 400 });
      if (saved) {
        const { data: post } = await db.from("feed_posts").select("id,status,expires_at").eq("id", postId).maybeSingle();
        if (!post || post.status !== "approved" || (post.expires_at && new Date(post.expires_at).getTime() <= Date.now())) return NextResponse.json({ allowed: false, message: "This post is no longer available." }, { status: 404 });
        const { error } = await db.from("feed_post_bookmarks").upsert({ post_id: postId, user_id: user.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
        if (error) return NextResponse.json({ allowed: false, message: "Couldn't save this post. Please try again." }, { status: 400 });
      } else {
        const { error } = await db.from("feed_post_bookmarks").delete().eq("post_id", postId).eq("user_id", user.id);
        if (error) return NextResponse.json({ allowed: false, message: "Couldn't update your saved posts. Please try again." }, { status: 400 });
      }
      return NextResponse.json({ allowed: true });
    }

    // Pin / unpin: official (admin) accounts only.
    if (kind === "pin") {
      if (!isAdmin) return NextResponse.json({ allowed: false, message: "Only HoopCheck can pin posts." }, { status: 403 });
      const postId = String(form.get("post_id") || "").trim();
      const pinned = String(form.get("pinned") || "") === "true";
      if (!postId) return NextResponse.json({ allowed: false, message: "Couldn't update the pin. Please try again." }, { status: 400 });
      const { data: targetPost, error: targetError } = await db.from("feed_posts")
        .select("id,status,expires_at").eq("id", postId).maybeSingle();
      if (targetError) return NextResponse.json({ allowed: false, message: "Couldn't update the pin. Please try again." }, { status: 500 });
      if (!targetPost || (pinned && (targetPost.status !== "approved" || (targetPost.expires_at && new Date(targetPost.expires_at).getTime() <= Date.now())))) {
        return NextResponse.json({ allowed: false, message: "This post is no longer available for pinning." }, { status: 404 });
      }
      const { error } = await db.from("feed_posts").update({ is_pinned: pinned, pinned_at: pinned ? new Date().toISOString() : null }).eq("id", postId);
      if (error) return NextResponse.json({ allowed: false, message: "Couldn't update the pin. Please try again." }, { status: 400 });
      return NextResponse.json({ allowed: true });
    }

    // Re-share any approved community post.
    // The source has already passed moderation; new user-authored content still uses moderate().
    if (kind === "share") {
      const sourceId = String(form.get("post_id") || "").trim();
      if (!sourceId) return NextResponse.json({ allowed: false, message: "Couldn't share — try again." }, { status: 400 });
      const { data: source, error: sourceError } = await db.from("feed_posts")
        .select("id,author_id,body,image_url,image_urls,video_url,post_kind,topic_tag,game_day_team,game_day_opponent,game_day_score_for,game_day_score_against,status,expires_at")
        .eq("id", sourceId).maybeSingle();
      if (sourceError) {
        console.error("HoopFeed share source lookup failed", { sourceId, code: sourceError.code });
        return NextResponse.json({ allowed: false, message: "Couldn't share — try again." }, { status: 500 });
      }
      if (!source || source.status !== "approved" || (source.expires_at && new Date(source.expires_at).getTime() <= Date.now())) {
        return NextResponse.json({ allowed: false, message: "This post is no longer available and can't be shared." }, { status: 404 });
      }
      if (source.post_kind === "poll") {
        return NextResponse.json({ allowed: false, message: "Polls can't be shared — vote on the original instead." }, { status: 400 });
      }
      const sharedAt = new Date();
      const expiresAt = new Date("2100-01-01T00:00:00.000Z");
      const sourceImageUrls = Array.isArray(source.image_urls) && source.image_urls.length ? source.image_urls as string[] : (source.image_url ? [source.image_url] : []);
      const { data: shared, error: shareError } = await db.from("feed_posts").insert({
        author_id: user.id, body: source.body, image_url: source.image_url, image_urls: sourceImageUrls, video_url: source.video_url, post_kind: "discussion",
        topic_tag: source.topic_tag, game_day_team: source.game_day_team,
        game_day_opponent: source.game_day_opponent, game_day_score_for: source.game_day_score_for,
        game_day_score_against: source.game_day_score_against, location_country: null,
        shared_post_id: source.id, status: "approved",
        created_at: sharedAt.toISOString(), expires_at: expiresAt.toISOString()
      }).select("id").single();
      if (shareError) {
        console.error("HoopFeed share insert failed", { userId: user.id, sourceId, code: shareError.code });
        return NextResponse.json({ allowed: false, message: "Couldn't share — try again." }, { status: 500 });
      }
      return NextResponse.json({ allowed: true, post_id: shared.id, shared_at: sharedAt.toISOString(), expires_at: expiresAt.toISOString() });
    }

    // Stage 2 post kinds: "news" is reserved for official (admin) accounts; "poll" carries options.
    const submittedKind = String(form.get("post_kind") || "discussion").trim();
    const postKind = kind !== "post" ? "discussion" : submittedKind === "news" && isAdmin ? "news" : submittedKind === "poll" ? "poll" : "discussion";
    let pollOptions: string[] | null = null;
    if (kind === "post" && postKind === "poll") {
      let parsed: unknown = null;
      try { parsed = JSON.parse(String(form.get("poll_options") || "[]")); } catch { parsed = null; }
      const cleaned = Array.isArray(parsed) ? parsed.map((o) => String(o ?? "").trim().slice(0, 60)).filter(Boolean) : [];
      if (!text) return NextResponse.json({ allowed: false, message: "Add a question for your poll." }, { status: 400 });
      if (cleaned.length < 2 || cleaned.length > 4) return NextResponse.json({ allowed: false, message: "Polls need 2 to 4 options." }, { status: 400 });
      if (new Set(cleaned.map((option) => option.toLocaleLowerCase())).size !== cleaned.length) return NextResponse.json({ allowed: false, message: "Poll options must be different." }, { status: 400 });
      if (videoPath || allImages.length) return NextResponse.json({ allowed: false, message: "Polls are text only for now — remove the photo or video." }, { status: 400 });
      pollOptions = cleaned;
    }

    if (kind === "post" && !text && allImages.length === 0 && !videoPath) {
      return NextResponse.json({ allowed: false, message: "Add text, a photo, or a video before posting." }, { status: 400 });
    }

    const moderationText = kind === "post" && postKind === "poll" ? text + "\n" + (pollOptions ?? []).join("\n") : text;
    const result = await moderate(moderationText, allImages[0] ?? null);
    if (!result.allowed) return NextResponse.json({ allowed: false, message: result.message }, { status: result.status });

    // Moderate every attached photo before any storage upload or publication.
    const otherPhotoResults = await Promise.all(allImages.slice(1).map(photo => moderate("", photo)));
    const photoRejection = otherPhotoResults.find(decision => !decision.allowed);
    if (photoRejection) return NextResponse.json({ allowed: false, message: photoRejection.message }, { status: photoRejection.status });

    if (kind === "comment") {
      if (!text) return NextResponse.json({ allowed: false, message: "Write a comment before posting." }, { status: 400 });
      const postId = String(form.get("post_id") || "");
      if (!postId) return NextResponse.json({ allowed: false, message: "Post not found." }, { status: 400 });
      const { data: post } = await db.from("feed_posts").select("id,author_id,expires_at,status").eq("id",postId).maybeSingle();
      if (!post || post.status !== "approved" || (post.expires_at && new Date(post.expires_at).getTime() <= Date.now())) {
        return NextResponse.json({ allowed: false, message: "This HoopFeed post is no longer available." }, { status: 404 });
      }
      const { error } = await db.from("feed_post_comments").insert({ post_id:postId,author_id:user.id,body:text });
      if (error) return NextResponse.json({ allowed:false,message:"We couldn't publish your comment. Please try again." },{status:400});
      return NextResponse.json({ allowed:true });
    }

    let image_url: string | null = null;
    let video_url: string | null = null;
    const image_urls: string[] = [];
    for (const f of allImages) {
      const path = user.id + "/" + crypto.randomUUID() + "." + IMAGE_EXTENSIONS[f.type];
      const bytes = Buffer.from(await f.arrayBuffer());
      const { error } = await db.storage.from("feed-images").upload(path,bytes,{contentType:f.type,cacheControl:"31536000",upsert:false});
      if (error) return NextResponse.json({ allowed:false,message:"Photo upload failed. Your post was not published." },{status:400});
      image_urls.push(db.storage.from("feed-images").getPublicUrl(path).data.publicUrl);
    }
    if (image_urls.length) image_url = image_urls[0];
    if (videoPath) video_url = db.storage.from("feed-videos").getPublicUrl(videoPath).data.publicUrl;
    const shareCountry = String(form.get("share_country") || "false") === "true";
    const submittedCountry = String(form.get("post_country") || "").trim().slice(0, 100);
    const { error } = await db.from("feed_posts").insert({
      author_id:user.id, body:text || " ", image_url, image_urls, video_url, post_kind:postKind, poll_options:pollOptions,
      topic_tag: submittedTopicTag ? submittedTopicTag : null,
      game_day_team: submittedTopicTag === "Game Day" ? gameDayTeam : null,
      game_day_opponent: submittedTopicTag === "Game Day" ? gameDayOpponent : null,
      game_day_score_for: submittedTopicTag === "Game Day" ? scoreFor : null,
      game_day_score_against: submittedTopicTag === "Game Day" ? scoreAgainst : null,
      location_country:shareCountry && profile?.current_country_public !== false ? (submittedCountry || profile?.current_country || null) : null,
      status:"approved", expires_at:new Date("2100-01-01T00:00:00.000Z").toISOString()
    });
    if (error) return NextResponse.json({ allowed:false,message:"We couldn't publish your post. Please try again." },{status:400});
    const activityDate = new Date().toISOString().slice(0, 10);
    const { error: activityError } = await db.from("feed_posting_activity").upsert({ user_id: user.id, activity_date: activityDate }, { onConflict: "user_id,activity_date", ignoreDuplicates: true });
    if (activityError) console.error("HoopFeed posting streak activity could not be recorded:", activityError.message);
    return NextResponse.json({ allowed:true });
  } catch (error: any) {
    console.error("HoopFeed moderation request failed:", error);
    return NextResponse.json({ allowed:false,message:"Safety moderation failed. Your content was not published." },{status:500});
  }
}