import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing server Supabase configuration.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function moderate(text: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { allowed: false, status: 503, message: "Safety moderation is temporarily unavailable. Your update was not published." };
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
  } catch {
    return { allowed: false, status: 502, message: "Safety moderation is temporarily unavailable." };
  }
  if (!response.ok) return { allowed: false, status: 502, message: "Safety moderation is temporarily unavailable." };
  const result = (await response.json().catch(() => null))?.results?.[0];
  if (!result || typeof result.flagged !== "boolean") return { allowed: false, status: 502, message: "Safety moderation returned no valid result." };
  if (result.flagged) return { allowed: false, status: 400, message: "This update was blocked by HoopCheck safety moderation." };
  return { allowed: true, status: 200, message: "ok" };
}

export async function POST(request: Request) {
  try {
    const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return NextResponse.json({ allowed: false, message: "Sign in is required." }, { status: 401 });
    const db = adminClient();
    const { data: userData, error: userError } = await db.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return NextResponse.json({ allowed: false, message: "Your session is invalid." }, { status: 401 });

    const payload = await request.json();
    const teamId = String(payload.team_id || "");
    const body = String(payload.body || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(teamId))
      return NextResponse.json({ allowed: false, message: "Choose a valid team profile." }, { status: 400 });
    if (!body || body.length > 1000)
      return NextResponse.json({ allowed: false, message: "Write an update between 1 and 1,000 characters." }, { status: 400 });

    const { data: claim } = await db.from("profile_claim_requests")
      .select("id").eq("entity_type", "team").eq("entity_id", teamId)
      .eq("requester_id", user.id).eq("status", "approved").maybeSingle();
    if (!claim) return NextResponse.json({ allowed: false, message: "An approved claim for this team is required." }, { status: 403 });

    const moderation = await moderate(body);
    if (!moderation.allowed) return NextResponse.json({ allowed: false, message: moderation.message }, { status: moderation.status });

    const { data: post, error } = await db.from("team_fanfeed_posts")
      .insert({ team_id: teamId, author_id: user.id, body, status: "published" })
      .select("id,team_id,body,created_at,status").single();
    if (error || !post) return NextResponse.json({ allowed: false, message: "Your official update could not be published." }, { status: 400 });
    return NextResponse.json({ allowed: true, post });
  } catch (error) {
    console.error("Team FanFeed publishing failed", error);
    return NextResponse.json({ allowed: false, message: "Team FanFeed could not complete the request." }, { status: 500 });
  }
}
