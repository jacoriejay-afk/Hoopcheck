import { NextResponse } from "next/server";
import { authenticateModerationRequest } from "../../../../lib/server/review-moderation";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const columns = "id,status,title,body,overall_rating,created_at,is_anonymous,coach_id,team_id,league_id";
export async function GET(request: Request) {
  try {
    const auth = await authenticateModerationRequest(request);
    if (!auth.ok) {
      const denied = auth.response;
      denied.headers.set("Cache-Control", headers["Cache-Control"]);
      denied.headers.set("Vary", headers.Vary);
      return denied;
    }
    // Preserve caller RLS. Never accept review IDs or author filters from the client.
    const visible = await auth.scoped.from("reviews").select(columns)
      .eq("status", "approved").order("created_at", { ascending: false })
      .order("id", { ascending: false }).limit(100);
    if (visible.error) throw Error("Review visibility check failed.");
    const rows = visible.data ?? [];
    const ids = rows.filter(row => row.is_anonymous === false).map(row => row.id);
    const authors = new Map<string, string>();
    if (ids.length) {
      // Recheck publication and attribution in the privileged query itself.
      const attributed = await auth.supabase.from("reviews").select("id,author_id,is_anonymous")
        .in("id", ids).eq("status", "approved").eq("is_anonymous", false);
      if (attributed.error) throw Error("Review attribution lookup failed.");
      for (const row of attributed.data ?? []) {
        if (ids.includes(row.id) && row.is_anonymous === false && row.author_id) authors.set(row.id, row.author_id);
      }
    }
    return NextResponse.json({ reviews: rows.map(row => ({
      id: row.id, status: row.status, title: row.title, body: row.body,
      overall_rating: row.overall_rating, created_at: row.created_at,
      is_anonymous: row.is_anonymous !== false,
      coach_id: row.coach_id, team_id: row.team_id, league_id: row.league_id,
      author_id: row.is_anonymous === false ? authors.get(row.id) ?? null : null,
    })) }, { headers });
  } catch {
    return NextResponse.json({ error: "Published reviews could not be loaded." }, { status: 503, headers });
  }
}
