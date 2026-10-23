import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    if (kind !== "post" && kind !== "comment" && kind !== "share") {
      return NextResponse.json({ allowed: false, message: "Unsupported content type." }, { status: 400 });
    }
    const text = String(form.get("text") || "").trim();
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ allowed: false, message: "Text must be 2,000 characters or fewer." }, { status: 413 });
    }
    const imageValue = form.get("image");
    const image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;
    const videoPath = String(form.get("video_path") || "");
    const videoType = String(form.get("video_type") || "");
    if (image && !ALLOWED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json({ allowed: false, message: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
    }
    if (videoPath && (!ALLOWED_VIDEO_TYPES.has(videoType) || !videoPath.startsWith(user.id + "/") || videoPath.includes("..") || videoPath.length > 240)) return NextResponse.json({ allowed:false, message:"Invalid video upload. Choose a supported video and try again." }, { status:400 });
    if (videoPath && !text) return NextResponse.json({ allowed:false, message:"Add a caption so HoopCheck can run text safety checks before publishing a video." }, { status:400 });
    if (kind === "comment" && (image || videoPath)) {
      return NextResponse.json({ allowed: false, message: "Photos and videos can only be added to posts." }, { status: 400 });
    }

    const { data: profile } = await db.from("profiles").select("account_type,current_country,current_country_public").eq("id", user.id).maybeSingle();
    if ((kind === "post" || kind === "share") && profile?.account_type !== "player") return NextResponse.json({ allowed: false, message: "Only player accounts can publish or share to HoopFeed." }, { status: 403 });
    if (kind === "comment" && profile?.account_type !== "player") return NextResponse.json({ allowed: false, message: "Only players can comment on HoopFeed posts." }, { status: 403 });
    const submittedTopicTag = String(form.get("topic_tag") || "").trim();
    const gameDayTeam = String(form.get("game_day_team") || "").trim().slice(0, 80);
    const gameDayOpponent = String(form.get("game_day_opponent") || "").trim().slice(0, 80);
    const scoreForRaw = String(form.get("game_day_score_for") || "").trim();
    const scoreAgainstRaw = String(form.get("game_day_score_against") || "").trim();
    const scoreFor = scoreForRaw === "" ? null : Number(scoreForRaw);
    const scoreAgainst = scoreAgainstRaw === "" ? null : Number(scoreAgainstRaw);
    if (kind === "post" && submittedTopicTag && (profile?.account_type !== "player" || !ALLOWED_TOPIC_TAGS.has(submittedTopicTag))) {
      return NextResponse.json({ allowed: false, message: "Choose a valid HoopFeed topic as a player." }, { status: 400 });
    }
    if (kind === "post" && submittedTopicTag === "Game Day") {
      const scoresValid = (scoreFor === null && scoreAgainst === null) || (Number.isInteger(scoreFor) && Number.isInteger(scoreAgainst) && scoreFor! >= 0 && scoreFor! <= 300 && scoreAgainst! >= 0 && scoreAgainst! <= 300);
      if (!gameDayTeam || !gameDayOpponent || !scoresValid) return NextResponse.json({ allowed: false, message: "Add both teams and enter both final scores, or leave both scores blank until after the game." }, { status: 400 });
    }
    const { data: sub } = await db.from("subscriptions").select("plan,status,access_status").eq("user_id", user.id).maybeSingle();
    const activeAccess = ["player","fan"].includes(profile?.account_type || "") &&
      ["pro","premium"].includes(sub?.plan || "") &&
      ["active","trialing"].includes(sub?.status || "") &&
      ["active","trialing","pro","premium"].includes(sub?.access_status ?? "active");
    if (!activeAccess) return NextResponse.json({ allowed: false, message: "Active Pro or Premium player access is required." }, { status: 403 });

    // Re-share only live, approved posts the player is permitted to view.
    // The source has already passed moderation; new user-authored content still uses moderate().
    if (kind === "share") {
      const sourceId = String(form.get("post_id") || "").trim();
      if (!sourceId) return NextResponse.json({ allowed: false, message: "Couldn't share — try again." }, { status: 400 });
      const { data: source, error: sourceError } = await db.from("feed_posts")
        .select("id,author_id,body,image_url,video_url,topic_tag,game_day_team,game_day_opponent,game_day_score_for,game_day_score_against,status,expires_at")
        .eq("id", sourceId).maybeSingle();
      if (sourceError) {
        console.error("HoopFeed share source lookup failed", { sourceId, code: sourceError.code });
        return NextResponse.json({ allowed: false, message: "Couldn't share — try again." }, { status: 500 });
      }
      if (!source || source.status !== "approved" || !source.expires_at || new Date(source.expires_at).getTime() <= Date.now()) {
        return NextResponse.json({ allowed: false, message: "This post has expired and can't be shared." }, { status: 404 });
      }
      if (source.author_id !== user.id) {
        const [{ data: sourceAuthor }, { data: follow }, { data: connection }] = await Promise.all([
          db.from("profiles").select("account_type").eq("id", source.author_id).maybeSingle(),
          db.from("follow_relationships").select("follower_id").eq("follower_id", user.id).eq("target_type", "player").eq("target_id", source.author_id).maybeSingle(),
          db.from("player_contact_requests").select("id,requester_id,player_id")
            .eq("status", "accepted")
            .or(`and(requester_id.eq.${user.id},player_id.eq.${source.author_id}),and(requester_id.eq.${source.author_id},player_id.eq.${user.id})`)
            .limit(1).maybeSingle()
        ]);
        // Match the same visibility rules used by the feed loader: players may see posts
        // from players they follow or have an accepted contact connection with.
        if ((!follow && !connection) || sourceAuthor?.account_type !== "player") {
          return NextResponse.json({ allowed: false, message: "You can only share posts you're allowed to view." }, { status: 403 });
        }
      }
      const sharedAt = new Date();
      const expiresAt = new Date(sharedAt.getTime() + 24 * 60 * 60 * 1000);
      const { data: shared, error: shareError } = await db.from("feed_posts").insert({
        author_id: user.id, body: source.body, image_url: source.image_url, video_url: source.video_url,
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

    const result = await moderate(text, image);
    if (!result.allowed) return NextResponse.json({ allowed: false, message: result.message }, { status: result.status });

    if (kind === "comment") {
      const postId = String(form.get("post_id") || "");
      if (!postId) return NextResponse.json({ allowed: false, message: "Post not found." }, { status: 400 });
      const { data: post } = await db.from("feed_posts").select("id,author_id,expires_at,status").eq("id",postId).maybeSingle();
      if (!post || post.status !== "approved" || new Date(post.expires_at).getTime() <= Date.now()) {
        return NextResponse.json({ allowed: false, message: "This HoopFeed post is no longer available." }, { status: 404 });
      }
      const { data: author } = await db.from("profiles").select("account_type,current_country").eq("id",post.author_id).maybeSingle();
      const sameCountry = !!profile?.current_country && !!author?.current_country && profile.current_country.toLowerCase() === author.current_country.toLowerCase();
      const followType = author?.account_type === "fan" ? "fan" : "player";
      const { data: follow } = await db.from("follow_relationships").select("follower_id").eq("follower_id",user.id).eq("target_type",followType).eq("target_id",post.author_id).maybeSingle();
      const allowedFollow = author?.account_type === "fan" ? !!follow : author?.account_type === "player" && sameCountry && !!follow;
      if (post.author_id !== user.id && !allowedFollow) {
        return NextResponse.json({ allowed: false, message: "You are not eligible to interact with this HoopFeed post." }, { status: 403 });
      }
      const { error } = await db.from("feed_post_comments").insert({ post_id:postId,author_id:user.id,body:text });
      if (error) return NextResponse.json({ allowed:false,message:"We couldn't publish your comment. Please try again." },{status:400});
      return NextResponse.json({ allowed:true });
    }

    let image_url: string | null = null;
    let video_url: string | null = null;
    if (image) {
      const path = user.id + "/" + crypto.randomUUID() + "." + IMAGE_EXTENSIONS[image.type];
      const bytes = Buffer.from(await image.arrayBuffer());
      const { error } = await db.storage.from("feed-images").upload(path,bytes,{contentType:image.type,cacheControl:"31536000",upsert:false});
      if (error) return NextResponse.json({ allowed:false,message:"Photo upload failed. Your post was not published." },{status:400});
      image_url = db.storage.from("feed-images").getPublicUrl(path).data.publicUrl;
    }
    if (videoPath) video_url = db.storage.from("feed-videos").getPublicUrl(videoPath).data.publicUrl;
    const shareCountry = String(form.get("share_country") || "false") === "true";
    const submittedCountry = String(form.get("post_country") || "").trim().slice(0, 100);
    const { error } = await db.from("feed_posts").insert({
      author_id:user.id, body:text || " ", image_url, video_url,
      topic_tag: profile?.account_type === "player" && submittedTopicTag ? submittedTopicTag : null,
      game_day_team: profile?.account_type === "player" && submittedTopicTag === "Game Day" ? gameDayTeam : null,
      game_day_opponent: profile?.account_type === "player" && submittedTopicTag === "Game Day" ? gameDayOpponent : null,
      game_day_score_for: profile?.account_type === "player" && submittedTopicTag === "Game Day" ? scoreFor : null,
      game_day_score_against: profile?.account_type === "player" && submittedTopicTag === "Game Day" ? scoreAgainst : null,
      location_country:shareCountry && profile?.current_country_public !== false ? (submittedCountry || profile?.current_country || null) : null,
      status:"approved", expires_at:new Date(Date.now()+86400000).toISOString()
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