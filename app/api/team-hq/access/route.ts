import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getHoopCheckEntitlements } from "../../../../lib/membership-tier";
import { resolveClubGrant } from "../../../../lib/team-hq-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Read-only, authenticated, club-scoped capability discovery for Team HQ. */
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ allowed: false, message: "Sign in required." }, { status: 401 });
  const clubId = new URL(request.url).searchParams.get("clubId") || "";
  if (!UUID.test(clubId)) return NextResponse.json({ allowed: false, message: "Valid club ID required." }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ allowed: false, message: "Authorization unavailable." }, { status: 503 });
  try {
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return NextResponse.json({ allowed: false, message: "Invalid session." }, { status: 401 });
    const grant = await resolveClubGrant(user.id, clubId);
    const entitlements = getHoopCheckEntitlements({ accountType: null, clubId, clubGrant: grant });
    if (!grant) return NextResponse.json({ allowed: false, message: "No approved claim for this club." }, { status: 403 });
    return NextResponse.json({
      allowed: true,
      clubId,
      role: grant.role,
      capabilities: entitlements.clubCapabilities,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ allowed: false, message: "Club access could not be verified." }, { status: 503 });
  }
}
