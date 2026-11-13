import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const invitationId = input && typeof input === "object" && "invitationId" in input
    ? (input as { invitationId?: unknown }).invitationId : null;
  if (typeof invitationId !== "string" || !UUID.test(invitationId))
    return NextResponse.json({ error: "Valid invitation ID required." }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Authorization unavailable." }, { status: 503 });
  try {
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    if (!user.email_confirmed_at) return NextResponse.json({ error: "Verify your email before accepting." }, { status: 403 });
    const { data: clubId, error: rpcError } = await db.rpc("team_hq_accept_invitation", {
      p_actor: user.id, p_invitation: invitationId,
    });
    if (rpcError) return NextResponse.json({ error: "Invitation unavailable or not valid for this account." }, { status: 403 });
    return NextResponse.json({ accepted: true, clubId }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Invitation service unavailable." }, { status: 503 });
  }
}
