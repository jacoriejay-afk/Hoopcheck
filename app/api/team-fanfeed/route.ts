import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing server Supabase configuration.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function moderate(body: string, imageDataUrl?: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { allowed: false, status: 503, message: "Safety moderation is temporarily unavailable." };
  try {
    const input: any[] = [{ type: "text", text: body }];
    if (imageDataUrl) input.push({ type: "image_url", image_url: { url: imageDataUrl } });
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input }),
      signal: AbortSignal.timeout(20000), cache: "no-store",
    });
    if (!response.ok) return { allowed: false, status: 502, message: "Safety moderation is temporarily unavailable." };
    const result = (await response.json().catch(() => null))?.results?.[0];
    if (!result || typeof result.flagged !== "boolean") return { allowed: false, status: 502, message: "Safety moderation returned no valid result." };
    if (result.flagged) return { allowed: false, status: 400, message: "This update was blocked by HoopCheck safety moderation." };
    return { allowed: true, status: 200, message: "ok" };
  } catch {
    return { allowed: false, status: 502, message: "Safety moderation is temporarily unavailable." };
  }
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return NextResponse.json({ allowed: false, message: "Sign in is required." }, { status: 401 });
    const db = adminClient();
    const { data: userData, error: userError } = await db.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return NextResponse.json({ allowed: false, message: "Your session is invalid." }, { status: 401 });

    const form = await request.formData();
    const teamId = String(form.get("team_id") || "");
    const body = String(form.get("body") || "").trim();
    const image = form.get("image");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(teamId))
      return NextResponse.json({ allowed: false, message: "Choose a valid team profile." }, { status: 400 });
    if (!body || body.length > 1000)
      return NextResponse.json({ allowed: false, message: "Write an update between 1 and 1,000 characters." }, { status: 400 });
    if (image !== null && (!(image instanceof File) || !["image/jpeg","image/png","image/webp"].includes(image.type) || image.size > 8 * 1024 * 1024))
      return NextResponse.json({ allowed: false, message: "Choose a JPG, PNG, or WebP image up to 8 MB." }, { status: 400 });

    const { data: claim } = await db.from("profile_claim_requests").select("id")
      .eq("entity_type", "team").eq("entity_id", teamId).eq("requester_id", user.id).eq("status", "approved").maybeSingle();
    if (!claim) return NextResponse.json({ allowed: false, message: "An approved claim for this team is required." }, { status: 403 });

    let imageDataUrl: string | undefined;
    let bytes: Buffer | undefined;
    if (image instanceof File) {
      bytes = Buffer.from(await image.arrayBuffer());
      imageDataUrl = "data:" + image.type + ";base64," + bytes.toString("base64");
    }
    const moderation = await moderate(body, imageDataUrl);
    if (!moderation.allowed) return NextResponse.json({ allowed: false, message: moderation.message }, { status: moderation.status });

    let imageUrl: string | null = null;
    if (image instanceof File && bytes) {
      const extension = image.type === "image/jpeg" ? "jpg" : image.type === "image/png" ? "png" : "webp";
      uploadedPath = "team-posts/" + teamId + "/" + user.id + "/" + randomUUID() + "." + extension;
      const { error: uploadError } = await db.storage.from("feed-images").upload(uploadedPath, bytes, {
        contentType: image.type, cacheControl: "31536000", upsert: false,
      });
      if (uploadError) return NextResponse.json({ allowed: false, message: "The approved image could not be uploaded." }, { status: 400 });
      imageUrl = db.storage.from("feed-images").getPublicUrl(uploadedPath).data.publicUrl;
    }

    const { data: post, error } = await db.from("team_fanfeed_posts")
      .insert({ team_id: teamId, author_id: user.id, body, image_url: imageUrl, status: "published" })
      .select("id,team_id,body,image_url,created_at,status").single();
    if (error || !post) {
      if (uploadedPath) await db.storage.from("feed-images").remove([uploadedPath]);
      return NextResponse.json({ allowed: false, message: "Your official update could not be published." }, { status: 400 });
    }
    return NextResponse.json({ allowed: true, post });
  } catch (error) {
    console.error("Team FanFeed publishing failed", error);
    return NextResponse.json({ allowed: false, message: "Team FanFeed could not complete the request." }, { status: 500 });
  }
}
