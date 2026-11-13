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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) return NextResponse.json({ error: "Invalid post" }, { status: 400 });
  const viewer = createClient(url, publicKey, { global: { headers: { Authorization: "Bearer " + token } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: identity, error: authError } = await viewer.auth.getUser(token);
  if (authError || !identity.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  const { data: post, error: postError } = await viewer.from("fan_feed_posts").select("image_url,status,expires_at,author_id,team_id,womens_team_id").eq("id", postId).eq("status", "approved").maybeSingle();
  if (postError || !post || new Date(post.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Post unavailable" }, { status: 404 });
  if (post.author_id !== identity.user.id) {
    const teamId = post.womens_team_id || post.team_id;
    const [{ data: authorFollow }, { data: teamFollow }] = await Promise.all([
      viewer.from("follow_relationships").select("target_id").eq("follower_id", identity.user.id).eq("target_type", "fan").eq("target_id", post.author_id).maybeSingle(),
      teamId ? viewer.from("follow_relationships").select("target_id").eq("follower_id", identity.user.id).eq("target_type", "team").eq("target_id", teamId).maybeSingle() : Promise.resolve({ data: null })
    ]);
    if (!authorFollow && !teamFollow) return NextResponse.json({ error: "Post unavailable" }, { status: 404 });
  }
  const prefix = "hoopfeed-private-images/";
  if (!post.image_url?.startsWith(prefix)) return NextResponse.json({ error: "Unsupported image" }, { status: 400 });
  const path = post.image_url.slice(prefix.length);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(path)) return NextResponse.json({ error: "Invalid image" }, { status: 400 });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.storage.from("hoopfeed-private-images").createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Image unavailable" }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl }, { headers: { "Cache-Control": "no-store" } });
}
