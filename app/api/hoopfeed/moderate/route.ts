import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { allowed: false, status: 503, message: "HoopFeed safety moderation is not configured yet. The content was not published." };

  if (blockedByLocalRules(text)) return { allowed: false, status: 400, message: "Please remove profanity or abusive language before posting." };

  const input: any[] = [];
  if (text) input.push({ type: "text", text });
  if (image) {
    if (!image.type.startsWith("image/")) return { allowed: false, status: 400, message: "Only image files can be moderated." };
    if (image.size > 8 * 1024 * 1024) return { allowed: false, status: 400, message: "Image is too large." };
    const bytes = Buffer.from(await image.arrayBuffer());
    input.push({ type: "image_url", image_url: { url: "data:" + image.type + ";base64," + bytes.toString("base64") } });
  }
  if (!input.length) return { allowed: false, status: 400, message: "Add text or a photo before posting." };

  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input })
  });
  if (!response.ok) return { allowed: false, status: 502, message: "Safety moderation is temporarily unavailable. Your content was not published." };
  const data = await response.json();
  const result = data?.results?.[0];
  if (!result) return { allowed: false, status: 502, message: "Safety moderation returned no result. Your content was not published." };
  if (result.flagged) return { allowed: false, status: 400, message: "This content was blocked by HoopFeed safety moderation. Remove sexual/nude, violent, hateful, abusive, or otherwise prohibited content and try again." };
  return { allowed: true, status: 200, message: "ok" };
}

export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ allowed: false, message: "Sign in is required." }, { status: 401 });

    const db = adminClient();
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ allowed: false, message: "Your session is invalid. Please sign in again." }, { status: 401 });
    const user = userData.user;

    const form = await request.formData();
    const kind = String(form.get("kind") || "post");
    const text = String(form.get("text") || "").trim();
    const image = form.get("image") instanceof File ? form.get("image") as File : null;

    const { data: profile } = await db.from("profiles").select("account_type,current_country").eq("id", user.id).maybeSingle();
    const { data: sub } = await db.from("subscriptions").select("plan,status,access_status").eq("user_id", user.id).maybeSingle();
    const activeAccess = profile?.account_type === "player" &&
      ["pro","premium"].includes(sub?.plan || "") &&
      ["active","trialing"].includes(sub?.status || "") &&
      ["active","trialing","pro","premium"].includes(sub?.access_status ?? "active");
    if (!activeAccess) return NextResponse.json({ allowed: false, message: "Active Pro or Premium player access is required." }, { status: 403 });

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
      const { data: follow } = await db.from("follow_relationships").select("follower_id").eq("follower_id",user.id).eq("target_type","player").eq("target_id",post.author_id).maybeSingle();
      if (post.author_id !== user.id && !(author?.account_type === "player" && sameCountry && !!follow)) {
        return NextResponse.json({ allowed: false, message: "You are not eligible to interact with this HoopFeed post." }, { status: 403 });
      }
      const { error } = await db.from("feed_post_comments").insert({ post_id:postId,author_id:user.id,body:text });
      if (error) return NextResponse.json({ allowed:false,message:error.message },{status:400});
      return NextResponse.json({ allowed:true });
    }

    let image_url: string | null = null;
    if (image) {
      const path = user.id + "/" + crypto.randomUUID() + ".jpg";
      const bytes = Buffer.from(await image.arrayBuffer());
      const { error } = await db.storage.from("feed-images").upload(path,bytes,{contentType:"image/jpeg",cacheControl:"31536000",upsert:false});
      if (error) return NextResponse.json({ allowed:false,message:"Photo upload failed. Your post was not published." },{status:400});
      image_url = db.storage.from("feed-images").getPublicUrl(path).data.publicUrl;
    }
    const shareCountry = String(form.get("share_country") || "true") === "true";
    const { error } = await db.from("feed_posts").insert({
      author_id:user.id, body:text || " ", image_url,
      location_country:shareCountry ? (profile?.current_country || null) : null,
      status:"approved", expires_at:new Date(Date.now()+86400000).toISOString()
    });
    if (error) return NextResponse.json({ allowed:false,message:error.message },{status:400});
    return NextResponse.json({ allowed:true });
  } catch (error: any) {
    return NextResponse.json({ allowed:false,message:error?.message||"Safety moderation failed. Your content was not published." },{status:500});
  }
}
