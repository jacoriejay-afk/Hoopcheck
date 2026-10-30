import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing server Supabase configuration.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function authorize(request: Request) {
  const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return { error: NextResponse.json({ error: "Sign in is required." }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) return { error: NextResponse.json({ error: "Server authentication is not configured." }, { status: 503 }) };
  const userClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return { error: NextResponse.json({ error: "Your session is invalid." }, { status: 401 }) };
  const { data: allowed, error: roleError } = await userClient.rpc("is_current_user_admin_or_moderator");
  if (roleError || allowed !== true) return { error: NextResponse.json({ error: "Admin or moderator access is required." }, { status: 403 }) };
  return { user };
}

export async function GET(request: Request) {
  try {
    const auth = await authorize(request);
    if (auth.error) return auth.error;
    const db = serviceClient();
    const { data, error } = await db.from("team_fanfeed_posts")
      .select("id,team_id,author_id,body,status,created_at,updated_at,teams(name,logo_url)")
      .order("created_at", { ascending: false }).limit(300);
    if (error) return NextResponse.json({ error: "Official team updates could not be loaded." }, { status: 500 });
    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    console.error("Admin Team FanFeed load failed", error);
    return NextResponse.json({ error: "Admin Team FanFeed is temporarily unavailable." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authorize(request);
    if (auth.error) return auth.error;
    const payload = await request.json();
    const id = String(payload.id || "");
    const status = payload.status;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
        (status !== "published" && status !== "removed")) {
      return NextResponse.json({ error: "A valid post and moderation action are required." }, { status: 400 });
    }
    const db = serviceClient();
    const { data, error } = await db.from("team_fanfeed_posts")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id,status")
      .maybeSingle();
    if (error || !data) return NextResponse.json({ error: "The official update could not be changed." }, { status: 400 });
    return NextResponse.json({ post: data });
  } catch (error) {
    console.error("Admin Team FanFeed moderation failed", error);
    return NextResponse.json({ error: "The moderation action could not be completed." }, { status: 500 });
  }
}
