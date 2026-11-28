import { NextResponse } from "next/server";
import { authorizeModeratorRequest } from "../../../../lib/server/review-moderation";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const columns = "id,coach_id,team_id,league_id,overall_rating,communication_rating,professionalism_rating,development_rating,payment_rating,title,body,status,created_at";

export async function GET(request: Request) {
  try {
    const auth = await authorizeModeratorRequest(request);
    if (!auth.ok) {
      auth.response.headers.set("Cache-Control", headers["Cache-Control"]);
      auth.response.headers.set("Vary", headers.Vary);
      return auth.response;
    }
    // Keep existing caller RLS for the visible moderation queue.
    const result = await auth.scoped.from("reviews").select(columns)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1000);
    if (result.error) throw Error("Review queue lookup failed.");
    const rows = result.data ?? [];
    const ids: string[] = rows.map(row => row.id);
    const authors = new Map<string, string>();
    for (let start = 0; start < ids.length; start += 100) {
      const batch = ids.slice(start, start + 100);
      const scopedIds = new Set(batch);
      const attribution = await auth.supabase.from("reviews").select("id,author_id").in("id", batch);
      if (attribution.error) throw Error("Review author lookup failed.");
      for (const row of attribution.data ?? []) {
        if (scopedIds.has(row.id) && row.author_id) authors.set(row.id, row.author_id);
      }
    }
    return NextResponse.json({ reviews: rows.map(row => ({
      id: row.id, author_id: authors.get(row.id) ?? null,
      coach_id: row.coach_id, team_id: row.team_id, league_id: row.league_id,
      overall_rating: row.overall_rating, communication_rating: row.communication_rating,
      professionalism_rating: row.professionalism_rating, development_rating: row.development_rating,
      payment_rating: row.payment_rating, title: row.title, body: row.body,
      status: row.status, created_at: row.created_at,
    })) }, { headers });
  } catch {
    return NextResponse.json({ error: "Unable to load reviews." }, { status: 503, headers });
  }
}
