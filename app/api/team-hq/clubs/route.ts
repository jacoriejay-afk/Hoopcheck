import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveClubGrant } from "../../../../lib/team-hq-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List only clubs for which the signed-in user has a live, verified grant. */
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Authorization unavailable." }, { status: 503 });
  try {
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    const [claims, staff] = await Promise.all([
      db.from("profile_claim_requests").select("entity_id")
        .eq("requester_id", user.id).eq("entity_type", "team").eq("status", "approved").limit(100),
      db.from("team_hq_staff").select("club_id")
        .eq("user_id", user.id).is("revoked_at", null).limit(100),
    ]);
    if (claims.error || staff.error) return NextResponse.json({ error: "Club access unavailable." }, { status: 503 });
    const ids = Array.from(new Set([
      ...(claims.data || []).map(row => row.entity_id),
      ...(staff.data || []).map(row => row.club_id),
    ]));
    const verified = await Promise.all(ids.map(async id => ({ id, grant: await resolveClubGrant(user.id, id) })));
    const allowed = verified.filter(item => item.grant !== null);
    if (!allowed.length) return NextResponse.json({ clubs: [] }, { headers: { "Cache-Control": "no-store" } });
    const { data: teams, error: teamError } = await db.from("teams")
      .select("id,name,country,city").in("id", allowed.map(item => item.id)).order("name");
    if (teamError) return NextResponse.json({ error: "Club directory unavailable." }, { status: 503 });
    return NextResponse.json({
      clubs: (teams || []).map(team => ({
        ...team, role: allowed.find(item => item.id === team.id)?.grant?.role,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Club access unavailable." }, { status: 503 });
  }
}
