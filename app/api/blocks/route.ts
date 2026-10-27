import { NextResponse } from "next/server";
import { authenticateModerationRequest } from "../../../lib/server/review-moderation";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  const auth = await authenticateModerationRequest(request);
  if (!auth.ok) return auth.response;
  const db = auth.supabase as any;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const target = typeof body.userId === "string" ? body.userId : "";
  const action = body.action === "unblock" ? "unblock" : "block";
  if (!UUID.test(target) || target === auth.user.id) return NextResponse.json({ error: "Choose a valid user." }, { status: 400 });
  const { data: targetProfile, error: profileError } = await db.from("profiles").select("id").eq("id", target).maybeSingle();
  if (profileError || !targetProfile) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (action === "unblock") {
    const { error } = await db.from("user_blocks").delete().eq("blocker_id", auth.user.id).eq("blocked_id", target);
    if (error) return NextResponse.json({ error: "Could not unblock this user." }, { status: 500 });
  } else {
    const { error } = await db.from("user_blocks").upsert({ blocker_id: auth.user.id, blocked_id: target }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: "Could not block this user." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, action });
}
