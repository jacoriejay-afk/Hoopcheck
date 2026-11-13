import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return NextResponse.json({ error: "Invalid post" }, { status: 400 });
  const viewer = createClient(url, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: post, error: postError } = await viewer.from("team_fanfeed_posts").select("image_url,status").eq("id", postId).eq("status", "published").maybeSingle();
  if (postError || !post) return NextResponse.json({ error: "Post unavailable" }, { status: 404 });
  const prefix = "hoopfeed-private-images/";
  if (!post.image_url?.startsWith(prefix)) return NextResponse.json({ error: "Unsupported image" }, { status: 400 });
  const path = post.image_url.slice(prefix.length);
  if (!/^team-posts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path)) return NextResponse.json({ error: "Invalid image" }, { status: 400 });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.storage.from("hoopfeed-private-images").createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Image unavailable" }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl }, { headers: { "Cache-Control": "no-store" } });
}
