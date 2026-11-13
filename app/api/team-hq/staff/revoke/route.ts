import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveClubGrant } from "../../../../../lib/team-hq-access";
import { getHoopCheckEntitlements } from "../../../../../lib/membership-tier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const { clubId, targetUserId } = input;
  if (typeof clubId !== "string" || !UUID.test(clubId) ||
      typeof targetUserId !== "string" || !UUID.test(targetUserId))
    return NextResponse.json({ error: "Valid club and manager IDs required." }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Authorization unavailable." }, { status: 503 });
  try {
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    const grant = await resolveClubGrant(user.id, clubId);
    const entitlements = getHoopCheckEntitlements({ accountType: null, clubId, clubGrant: grant });
    if (grant?.role !== "owner" || !entitlements.clubCapabilities.manageStaff)
      return NextResponse.json({ error: "Club owner access required." }, { status: 403 });
    const { error: rpcError } = await db.rpc("team_hq_revoke_manager", {
      p_actor: user.id, p_club: clubId, p_target: targetUserId,
    });
    if (rpcError) return NextResponse.json({ error: "Manager revocation could not be completed." }, { status: 409 });
    return NextResponse.json({ revoked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Staff service unavailable." }, { status: 503 });
  }
}
