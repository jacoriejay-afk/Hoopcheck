import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveClubGrant } from "../../../../lib/team-hq-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Owner-only roster of active invited managers, scoped to one claimed club. */
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const clubId = new URL(request.url).searchParams.get("clubId") || "";
  if (!UUID.test(clubId)) return NextResponse.json({ error: "Valid club ID required." }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Authorization unavailable." }, { status: 503 });
  try {
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    const grant = await resolveClubGrant(user.id, clubId);
    if (grant?.role !== "owner" || !grant.manageStaff)
      return NextResponse.json({ error: "Club owner access required." }, { status: 403 });
    const { data, error: staffError } = await db.from("team_hq_staff")
      .select("user_id,accepted_at").eq("club_id", clubId).is("revoked_at", null)
      .order("accepted_at", { ascending: false }).limit(100);
    if (staffError) return NextResponse.json({ error: "Staff unavailable." }, { status: 503 });
    // A non-revoked row is not itself an authorization grant. Exclude stale
    // rows whose invitation or inviting owner's claim is no longer valid.
    const verified = await Promise.all((data || []).map(async row => ({
      row, grant: await resolveClubGrant(row.user_id, clubId),
    })));
    return NextResponse.json({ staff: verified
      .filter(({ grant }) => grant?.role === "manager")
      .map(({ row }) => ({ userId: row.user_id, joinedAt: row.accepted_at })) },
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Staff unavailable." }, { status: 503 });
  }
}
