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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const viewerDb = supabaseUrl && publishableKey ? createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: "Bearer " + token } },
      auth: { autoRefreshToken: false, persistSession: false },
    }) : null;

    // Use the caller's RLS before existing-post actions that require privileged writes.
    async function canInteractWithPost(postId: string): Promise<boolean> {
      if (!viewerDb) return false;
      const { data, error } = await viewerDb.from("feed_posts")
        .select("id").eq("id", postId).eq("status", "approved")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .maybeSingle();
      return !error && !!data;
    }

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
    const kindValues = form.getAll("kind");
    if (kindValues.length > 1 || (kindValues.length === 1 && typeof kindValues[0] !== "string")) {
      return NextResponse.json({ allowed: false, message: "Invalid HoopFeed action." }, { status: 400 });
    }
    const kind = kindValues.length === 0 ? "post" : kindValues[0];
    if (kind !== "post" && kind !== "edit" && kind !== "comment" && kind !== "share" && kind !== "vote" && kind !== "bookmark" && kind !== "pin" && kind !== "community-pin") {
      return NextResponse.json({ allowed: false, message: "Unsupported content type." }, { status: 400 });
    }
    const postIdValues = form.getAll("post_id");
    if (kind !== "post" && (postIdValues.length !== 1 || typeof postIdValues[0] !== "string" || !postIdValues[0].trim())) {
      return NextResponse.json({ allowed: false, message: "Provide one valid post ID." }, { status: 400 });
    }
    const actionPostId = kind === "post" ? "" : (postIdValues[0] as string).trim();
    // All non-create actions target a feed_posts UUID. Reject malformed identifiers
    // before any privileged lookup, including service-role comment/reply writes.
    if (kind !== "post" && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(actionPostId)) {
      return NextResponse.json({ allowed: false, message: "Invalid post ID." }, { status: 400 });
    }
    const textValues = form.getAll("text");
    if (textValues.length > 1 || (textValues.length === 1 && typeof textValues[0] !== "string")) {
      return NextResponse.json({ allowed: false, message: "Invalid HoopFeed text field." }, { status: 400 });
    }
    const text = typeof textValues[0] === "string" ? textValues[0].trim() : "";
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ allowed: false, message: "Text must be 2,000 characters or fewer." }, { status: 413 });
    }
    const imageValues = form.getAll("image");
    if (imageValues.length > 1) return NextResponse.json({ allowed: false, message: "Upload one primary photo and use the additional photos field for the rest." }, { status: 400 });
    const imageValue = imageValues[0] ?? null;
    if (imageValue !== null && (!(imageValue instanceof File) || imageValue.size === 0)) {
      return NextResponse.json({ allowed: false, message: "Remove the invalid or empty primary photo and try again." }, { status: 400 });
    }
    const image = imageValue instanceof File ? imageValue : null;
    const extraImageValues = form.getAll("images");
    if (extraImageValues.some((value) => !(value instanceof File) || value.size === 0)) {
      return NextResponse.json({ allowed: false, message: "Remove invalid or empty photo attachments and try again." }, { status: 400 });
    }
    const extraImages = extraImageValues as File[];
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
    const videoPathValues = form.getAll("video_path");
    const videoTypeValues = form.getAll("video_type");
    if (videoPathValues.length > 1 || videoTypeValues.length > 1 || videoPathValues.some(value => typeof value !== "string") || videoTypeValues.some(value => typeof value !== "string")) {
      return NextResponse.json({ allowed: false, message: "Invalid video upload fields." }, { status: 400 });
    }
    const videoPath = typeof videoPathValues[0] === "string" ? videoPathValues[0] : "";
    const videoType = typeof videoTypeValues[0] === "string" ? videoTypeValues[0] : "";
    if ((videoPath && !videoType) || (!videoPath && videoType)) {
      return NextResponse.json({ allowed: false, message: "Video path and type must be provided together." }, { status: 400 });
    }
    if (image && !ALLOWED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json({ allowed: false, message: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
    }
    if (videoPath && (!ALLOWED_VIDEO_TYPES.has(videoType) || !videoPath.startsWith("hoopfeed-private-videos/" + user.id + "/") || videoPath.includes("..") || videoPath.length > 240)) return NextResponse.json({ allowed:false, message:"Invalid video upload. Choose a supported video and try again." }, { status:400 });
    if (videoPath && allImages.length > 0) return NextResponse.json({ allowed: false, message: "Choose photos or a video for one post, not both." }, { status: 400 });
    if (videoPath && !text) return NextResponse.json({ allowed:false, message:"Add a caption so HoopCheck can run text safety checks before publishing a video." }, { status:400 });
    if ((kind === "comment" || kind === "edit") && (allImages.length > 0 || videoPath)) {
      return NextResponse.json({ allowed: false, message: "Photos and videos can only be added to posts." }, { status: 400 });
    }

    const { data: profile } = await db.from("profiles").select("account_type,current_country,current_country_public").eq("id", user.id).maybeSingle();
    if (!profile) return NextResponse.json({ allowed: false, message: "Your account profile could not be found." }, { status: 403 });
    const submittedTopicTag = String(form.get("topic_tag") || "").trim();
    const gameDayTeam = String(form.get("game_day_team") || "").trim().slice(0, 80);
    const gameDayOpponent = String(form.get("game_day_opponent") || "").trim().slice(0, 80);
    const scoreForRaw = String(form.get("game_day_score_for") || "").trim();
    const scoreAgainstRaw = String(form.get("game_day_score_against") || "").trim();
    const scoreFor = scoreForRaw === "" ? null : /^\d{1,3}$/.test(scoreForRaw) ? Number(scoreForRaw) : NaN;
    const scoreAgainst = scoreAgainstRaw === "" ? null : /^\d{1,3}$/.test(scoreAgainstRaw) ? Number(scoreAgainstRaw) : NaN;
    if (kind === "post" && submittedTopicTag && !ALLOWED_TOPIC_TAGS.has(submittedTopicTag)) {
      return NextResponse.json({ allowed: false, message: "Choose a valid HoopFeed topic." }, { status: 400 });
    }
    if (kind === "post" && submittedTopicTag === "Game Day") {
      const scoresValid = (scoreFor === null && scoreAgainst === null) || (Number.isInteger(scoreFor) && Number.isInteger(scoreAgainst) && scoreFor! >= 0 && scoreFor! <= 300 && scoreAgainst! >= 0 && scoreAgainst! <= 300);
      if (!gameDayTeam || !gameDayOpponent || gameDayTeam.toLocaleLowerCase() === gameDayOpponent.toLocaleLowerCase() || !scoresValid) return NextResponse.json({ allowed: false, message: "Add two different teams and enter both final scores, or leave both scores blank until after the game." }, { status: 400 });
    }
    const { data: sub } = await db.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", user.id).maybeSingle();
    const { data: adminRoleRows } = await db.from("admin_roles").select("role").eq("user_id", user.id);
    const isAdmin = (adminRoleRows || []).some((r: any) => String(r?.role || "").trim().toLowerCase() === "admin");
    const entitlements = getHoopCheckEntitlements({ accountType: profile?.account_type, subscription: sub, isAdmin });
    if (!entitlements.canWriteHoopFeed) return NextResponse.json({ allowed: false, message: "An active Pro or Premium membership is required to use HoopFeed." }, { status: 403 });

    // Poll vote: one vote per member per poll; voting again changes the vote.
    if (kind === "vote") {
      if (!viewerDb) return NextResponse.json({ allowed: false, message: "Post unavailable." }, { status: 404 });
      const postId = actionPostId;
      const optionIndexValues = form.getAll("option_index");
      const optionIndexText = optionIndexValues.length === 1 && typeof optionIndexValues[0] === "string" ? optionIndexValues[0].trim() : "";
      const optionIndex = /^\d+$/.test(optionIndexText) ? Number(optionIndexText) : NaN;
      if (!postId || !Number.isInteger(optionIndex)) return NextResponse.json({ allowed: false, message: "That vote didn't go through. Please try again." }, { status: 400 });
      const { data: poll } = await viewerDb.from("feed_posts").select("id,status,post_kind,poll_options,expires_at").eq("id", postId).maybeSingle();
      const options = Array.isArray(poll?.poll_options) ? poll.poll_options as string[] : [];
      if (!poll || poll.status !== "approved" || poll.post_kind !== "poll" || (poll.expires_at && (!Number.isFinite(Date.parse(poll.expires_at)) || Date.parse(poll.expires_at) <= Date.now())) || optionIndex < 0 || optionIndex >= options.length) {
        return NextResponse.json({ allowed: false, message: "This poll is no longer available." }, { status: 404 });
      }
      const { error } = await viewerDb.from("feed_poll_votes").upsert({ post_id: postId, user_id: user.id, option_index: optionIndex }, { onConflict: "post_id,user_id" });
      if (error) return NextResponse.json({ allowed: false, message: "That vote didn't go through. Please try again." }, { status: 400 });
      return NextResponse.json({ allowed: true });
    }

    // Save / unsave a post (bookmark).
    if (kind === "bookmark") {
      const postId = actionPostId;
      const savedValues = form.getAll("saved");
      if (savedValues.length !== 1 || typeof savedValues[0] !== "string" || !["true", "false"].includes(savedValues[0])) {
        return NextResponse.json({ allowed: false, message: "Invalid saved state." }, { status: 400 });
      }
      const saved = savedValues[0] === "true";
      if (!postId) return NextResponse.json({ allowed: false, message: "Couldn't update your saved posts. Please try again." }, { status: 400 });
      if (!viewerDb) return NextResponse.json({ allowed: false, message: "Post unavailable." }, { status: 404 });
      if (saved) {
        const { data: post } = await viewerDb.from("feed_posts").select("id,author_id,status,expires_at").eq("id", postId).maybeSingle();
        if (!post || post.status !== "approved" || (post.expires_at && (!Number.isFinite(Date.parse(post.expires_at)) || Date.parse(post.expires_at) <= Date.now()))) return NextResponse.json({ allowed: false, message: "This post is no longer available." }, { status: 404 });
        const { error } = await viewerDb.from("feed_post_bookmarks").upsert({ post_id: postId, user_id: user.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
        if (error) return NextResponse.json({ allowed: false, message: "Couldn't save this post. Please try again." }, { status: 400 });
      } else {
        const { error } = await viewerDb.from("feed_post_bookmarks").delete().eq("post_id", postId).eq("user_id", user.id);
        if (error) return NextResponse.json({ allowed: false, message: "Couldn't update your saved posts. Please try again." }, { status: 400 });
      }
      return NextResponse.json({ allowed: true });
    }

    if (kind === "community-pin") {
      if (!isAdmin) return NextResponse.json({ allowed: false, message: "Admin access required." }, { status: 403 });
      const values = form.getAll("pinned");
      if (values.length !== 1 || (values[0] !== "true" && values[0] !== "false")) {
        return NextResponse.json({ allowed: false, message: "Invalid pinned state." }, { status: 400 });
      }
      if (!(await canInteractWithPost(actionPostId))) return NextResponse.json({ allowed: false, message: "Post unavailable." }, { status: 404 });
      const { error } = await db.from("feed_posts").update({
        community_pinned_at: values[0] === "true" ? new Date().toISOString() : null,
      }).eq("id", actionPostId).eq("status", "approved");
      if (error) return NextResponse.json({ allowed: false, message: "Could not update the HoopFeed pin." }, { status: 400 });
      return NextResponse.json({ allowed: true });
    }

    // Profile-only pinning: the authenticated author may pin only their own approved post.
    if (kind === "pin") {

      const postId = actionPostId;
      const pinnedValues = form.getAll("pinned");
      if (pinnedValues.length !== 1 || typeof pinnedValues[0] !== "string" || !["true", "false"].includes(pinnedValues[0])) {
        return NextResponse.json({ allowed: false, message: "Invalid pinned state." }, { status: 400 });
      }
      const pinned = pinnedValues[0] === "true";
      if (!postId) return NextResponse.json({ allowed: false, message: "Couldn't update the pin. Please try again." }, { status: 400 });
      const { data: targetPost, error: targetError } = await db.from("feed_posts")
        .select("id,author_id,status,expires_at").eq("id", postId).maybeSingle();
      if (targetError) return NextResponse.json({ allowed: false, message: "Couldn't update the pin. Please try again." }, { status: 500 });
      if (!targetPost || (pinned && (targetPost.status !== "approved"))) {
        return NextResponse.json({ allowed: false, message: "This post is no longer available for pinning." }, { status: 404 });
      }
      if (targetPost.author_id !== user.id) return NextResponse.json({ allowed: false, message: "You can only pin your own posts." }, { status: 403 });
      const { error } = await db.from("feed_posts").update({ is_pinned: pinned, pinned_at: pinned ? new Date().toISOString() : null }).eq("id", postId).eq("author_id", user.id);
      if (error) return NextResponse.json({ allowed: false, message: "Couldn't update the pin. Please try again." }, { status: 400 });
      return NextResponse.json({ allowed: true });
    }

    // Re-share any approved community post.
    // The source has already passed moderation; new user-authored content still uses moderate().
    if (kind === "share") {
      if (!viewerDb) return NextResponse.json({ allowed: false, message: "Post unavailable." }, { status: 404 });
      const sourceId = actionPostId;
      if (!sourceId) return NextResponse.json({ allowed: false, message: "Couldn't share — try again." }, { status: 400 });
      const { data: source, error: sourceError } = await viewerDb.from("feed_posts")
        .select("id,author_id,body,image_url,image_urls,video_url,post_kind,topic_tag,game_day_team,game_day_opponent,game_day_score_for,game_day_score_against,status,expires_at")
        .eq("id", sourceId).maybeSingle();
      if (sourceError) {
        console.error("HoopFeed share source lookup failed", { sourceId, code: sourceError.code });
        return NextResponse.json({ allowed: false, message: "Couldn't share — try again." }, { status: 500 });
      }
      if (!source || source.status !== "approved" || (source.expires_at && Date.parse(source.expires_at) <= Date.now())) {
        return NextResponse.json({ allowed: false, message: "This post is no longer available and can't be shared." }, { status: 404 });
      }
      if (source.post_kind === "poll") {
        return NextResponse.json({ allowed: false, message: "Polls can't be shared — vote on the original instead." }, { status: 400 });
      }
      const sharedAt = new Date();
      const expiresAt = null;
      const sourceImageUrls = Array.isArray(source.image_urls) && source.image_urls.length ? source.image_urls as string[] : (source.image_url ? [source.image_url] : []);
      const { data: shared, error: shareError } = await db.from("feed_posts").insert({
        author_id: user.id, body: source.body, image_url: source.image_url, image_urls: sourceImageUrls, video_url: source.video_url, post_kind: "discussion",
        topic_tag: source.topic_tag, game_day_team: source.game_day_team,
        game_day_opponent: source.game_day_opponent, game_day_score_for: source.game_day_score_for,
        game_day_score_against: source.game_day_score_against, location_country: null,
        shared_post_id: source.id, status: "approved",
        created_at: sharedAt.toISOString(), expires_at: expiresAt
      }).select("id").single();
      if (shareError) {
        console.error("HoopFeed share insert failed", { userId: user.id, sourceId, code: shareError.code });
        return NextResponse.json({ allowed: false, message: "Couldn't share — try again." }, { status: 500 });
      }
      return NextResponse.json({ allowed: true, post_id: shared.id, shared_at: sharedAt.toISOString(), expires_at: expiresAt });
    }

    // Stage 2 post kinds: "news" is reserved for official (admin) accounts; "poll" carries options.
    const postKindValues = form.getAll("post_kind");
    if (kind === "post" && (postKindValues.length > 1 || (postKindValues.length === 1 && typeof postKindValues[0] !== "string"))) {
      return NextResponse.json({ allowed: false, message: "Invalid post type." }, { status: 400 });
    }
    const submittedKind = kind === "post" && typeof postKindValues[0] === "string" ? postKindValues[0].trim() : "discussion";
    if (kind === "post" && !["discussion", "poll", "news"].includes(submittedKind)) {
      return NextResponse.json({ allowed: false, message: "Choose a valid post type." }, { status: 400 });
    }
    if (kind === "post" && submittedKind === "news" && !isAdmin) {
      return NextResponse.json({ allowed: false, message: "Only HoopCheck administrators can publish official news." }, { status: 403 });
    }
    const postKind = kind !== "post" ? "discussion" : submittedKind === "news" ? "news" : submittedKind === "poll" ? "poll" : "discussion";
    let pollOptions: string[] | null = null;
    if (kind === "post" && postKind === "poll") {
      const pollOptionValues = form.getAll("poll_options");
      if (pollOptionValues.length !== 1 || typeof pollOptionValues[0] !== "string") {
        return NextResponse.json({ allowed: false, message: "Provide one valid set of poll options." }, { status: 400 });
      }
      let parsed: unknown = null;
      try { parsed = JSON.parse(pollOptionValues[0]); } catch { parsed = null; }
      if (!Array.isArray(parsed) || parsed.some((option) => typeof option !== "string" || option.trim().length === 0 || option.trim().length > 60)) {
        return NextResponse.json({ allowed: false, message: "Each poll option must be text between 1 and 60 characters." }, { status: 400 });
      }
      const cleaned = parsed.map((option: string) => option.trim());
      if (!text) return NextResponse.json({ allowed: false, message: "Add a question for your poll." }, { status: 400 });
      if (cleaned.length < 2 || cleaned.length > 4) return NextResponse.json({ allowed: false, message: "Polls need 2 to 4 options." }, { status: 400 });
      if (new Set(cleaned.map((option) => option.toLocaleLowerCase())).size !== cleaned.length) return NextResponse.json({ allowed: false, message: "Poll options must be different." }, { status: 400 });
      if (videoPath || allImages.length) return NextResponse.json({ allowed: false, message: "Polls are text only for now — remove the photo or video." }, { status: 400 });
      pollOptions = cleaned;
    }

    if (kind === "post" && !text && allImages.length === 0 && !videoPath) {
      return NextResponse.json({ allowed: false, message: "Add text, a photo, or a video before posting." }, { status: 400 });
    }

    if (kind === "edit") {
      if (!text) return NextResponse.json({ allowed: false, message: "Post text cannot be empty." }, { status: 400 });
      if (!(await canInteractWithPost(actionPostId))) {
        return NextResponse.json({ allowed: false, message: "Post unavailable." }, { status: 404 });
      }
      const { data: existing, error: readError } = await db.from("feed_posts")
        .select("id").eq("id", actionPostId).eq("author_id", user.id).eq("status", "approved")
        .is("shared_post_id", null).maybeSingle();
      if (readError || !existing) {
        return NextResponse.json({ allowed: false, message: "You cannot edit this post." }, { status: 403 });
      }
      const decision = await moderate(text, null);
      if (!decision.allowed) return NextResponse.json({ allowed: false, message: decision.message }, { status: decision.status });
      const { data: updated, error: updateError } = await db.from("feed_posts")
        .update({ body: text }).eq("id", actionPostId).eq("author_id", user.id).eq("status", "approved")
        .is("shared_post_id", null).select("id").maybeSingle();
      if (updateError || !updated) {
        return NextResponse.json({ allowed: false, message: "Post edit failed. Please try again." }, { status: 400 });
      }
      return NextResponse.json({ allowed: true });
    }

    if (kind === "comment") {
      if (!text || text.length > 1000) {
        return NextResponse.json({ allowed: false, message: "Write a comment of up to 1,000 characters." }, { status: 400 });
      }
      if (!(await canInteractWithPost(actionPostId))) return NextResponse.json({ allowed: false, message: "Post unavailable." }, { status: 404 });
      const parentValues = form.getAll("parent_id");
      const parentId = parentValues[0];
      if (parentValues.length > 1 || (parentId !== undefined && (
        typeof parentId !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(parentId)
      ))) {
        return NextResponse.json({ allowed: false, message: "Invalid reply target." }, { status: 400 });
      }
      if (parentId) {
        const { data: parent, error } = await db.from("feed_post_comments")
          .select("id").eq("id", parentId).eq("post_id", actionPostId).maybeSingle();
        if (error || !parent) {
          return NextResponse.json({ allowed: false, message: "Reply target not found in this post." }, { status: 400 });
        }
      }
      const decision = await moderate(text, null);
      if (!decision.allowed) return NextResponse.json({ allowed: false, message: decision.message }, { status: decision.status });
      if (!(await canInteractWithPost(actionPostId))) return NextResponse.json({ allowed: false, message: "Post unavailable." }, { status: 404 });
      const { data: publishedComment, error } = await db.from("feed_post_comments").insert({
        post_id: actionPostId,
        author_id: user.id,
        body: text,
        ...(parentId ? { parent_id: parentId } : {}),
      }).select("id,post_id,body,created_at,author_id,parent_id").single();
      if (error) {
        console.error("HoopFeed comment insert failed", error.code);
        return NextResponse.json({ allowed: false, message: "We couldn't publish your comment. Please try again." }, { status: 400 });
      }
      return NextResponse.json({ allowed: true, comment: publishedComment });
    }

    const locationValues = form.getAll("post_location");
    const location = typeof locationValues[0] === "string" ? locationValues[0].trim() : "";
    if (locationValues.length > 1 || locationValues.some(value => typeof value !== "string") || location.length > 100) {
      return NextResponse.json({ allowed: false, message: "Enter a location of up to 100 characters." }, { status: 400 });
    }
    const tagColumns = { club_id: "teams", womens_club_id: "womens_teams", league_id: "leagues", womens_league_id: "womens_leagues" } as const;
    const tags = Object.entries(tagColumns).flatMap(([column, table]) => form.getAll(column).map(id => ({ column, table, id })));
    if (tags.length > 1 || tags.some(({ id }) => typeof id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))) {
      return NextResponse.json({ allowed: false, message: "Choose one club or league from the directory." }, { status: 400 });
    }
    const tag = tags[0];
    if (tag) {
      const { data: entity } = await db.from(tag.table).select("id").eq("active", true).eq("id", tag.id).maybeSingle();
      if (!entity) return NextResponse.json({ allowed: false, message: "This directory tag is unavailable." }, { status: 400 });
    }
    const moderationText = [text, ...(postKind === "poll" ? pollOptions ?? [] : []), location].filter(Boolean).join("\n");
    const result = await moderate(moderationText, allImages[0] ?? null);
    if (!result.allowed) return NextResponse.json({ allowed: false, message: result.message }, { status: result.status });

    // Moderate every attached photo before any storage upload or publication.
    const otherPhotoResults = await Promise.all(allImages.slice(1).map(photo => moderate("", photo)));
    const photoRejection = otherPhotoResults.find(decision => !decision.allowed);
    if (photoRejection) return NextResponse.json({ allowed: false, message: photoRejection.message }, { status: photoRejection.status });

    let image_url: string | null = null;
    let video_url: string | null = null;
    const image_urls: string[] = [];
    const uploadedImagePaths: string[] = [];
    const cleanupUploadedImages = async () => {
      if (!uploadedImagePaths.length) return;
      try {
        const { error: cleanupError } = await db.storage.from("hoopfeed-private-images").remove(uploadedImagePaths);
        if (cleanupError) console.error("HoopFeed orphaned photo cleanup failed:", cleanupError.message);
      } catch (cleanupError) {
        console.error("HoopFeed orphaned photo cleanup threw:", cleanupError);
      }
    };
    for (const f of allImages) {
      const path = user.id + "/" + crypto.randomUUID() + "." + IMAGE_EXTENSIONS[f.type];
      const bytes = Buffer.from(await f.arrayBuffer());
      const { error } = await db.storage.from("hoopfeed-private-images").upload(path,bytes,{contentType:f.type,cacheControl:"31536000",upsert:false});
      if (error) {
        await cleanupUploadedImages();
        return NextResponse.json({ allowed:false,message:"Photo upload failed. Your post was not published." },{status:400});
      }
      uploadedImagePaths.push(path);
      image_urls.push("hoopfeed-private-images/" + path);
    }
    if (image_urls.length) image_url = image_urls[0];
    if (videoPath) video_url = videoPath;
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
      ...(form.get("audience") === "community" ? { community_visible: true } : {}),
      ...(location ? { post_location: location } : {}),
      ...(tag ? { [tag.column]: tag.id } : {}),
      status:"approved", expires_at:null
    });
    if (error) {
      await cleanupUploadedImages();
      return NextResponse.json({ allowed:false,message:"We couldn't publish your post. Please try again." },{status:400});
    }
    const activityDate = new Date().toISOString().slice(0, 10);
    const { error: activityError } = await db.from("feed_posting_activity").upsert({ user_id: user.id, activity_date: activityDate }, { onConflict: "user_id,activity_date", ignoreDuplicates: true });
    if (activityError) console.error("HoopFeed posting streak activity could not be recorded:", activityError.message);
    return NextResponse.json({ allowed:true });
  } catch (error: any) {
    console.error("HoopFeed moderation request failed:", error);
    return NextResponse.json({ allowed:false,message:"Safety moderation failed. Your content was not published." },{status:500});
  }
}