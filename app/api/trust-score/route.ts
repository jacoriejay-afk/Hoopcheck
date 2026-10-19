import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateTrustScore, type TrustScoreReview } from "../../../lib/trust-score";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  team_id: string | null;
  coach_id: string | null;
  overall_rating: number | null;
  created_at: string;
  author_id: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType");
  const singularId = url.searchParams.get("entityId");
  const requestedIds = (url.searchParams.get("entityIds") || "")
    .split(",").map(value => value.trim()).filter(Boolean);
  const ids = Array.from(new Set([...(singularId ? [singularId] : []), ...requestedIds])).slice(0, 100);

  if (!["team", "coach"].includes(entityType || "") || ids.length === 0 ||
      ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    return NextResponse.json({ error: "Provide a valid entity type and one or more IDs." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Trust Score service is not configured." }, { status: 503 });
  }

  try {
    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const targetColumn = entityType === "team" ? "team_id" : "coach_id";
    const { data: rows, error } = await db.from("reviews")
      .select("id,team_id,coach_id,overall_rating,created_at,author_id")
      .eq("status", "approved")
      .in(targetColumn, ids);
    if (error) throw error;

    const reviews = (rows || []) as ReviewRow[];
    const authorIds = Array.from(new Set(reviews.map(row => row.author_id).filter(Boolean)));
    const verifiedByAuthor: Record<string, boolean> = {};
    if (authorIds.length) {
      const { data: authors, error: authorError } = await db.from("profiles")
        .select("id,player_verified").in("id", authorIds);
      if (authorError) throw authorError;
      for (const author of authors || []) verifiedByAuthor[author.id] = author.player_verified === true;
    }

    const scores: Record<string, ReturnType<typeof calculateTrustScore> & { averageRating: number | null }> = {};
    for (const id of ids) {
      const entityReviews = reviews.filter(row => (entityType === "team" ? row.team_id : row.coach_id) === id);
      const ratings = entityReviews.map(row => Number(row.overall_rating)).filter(value => Number.isFinite(value) && value >= 1 && value <= 5);
      const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
      const scoreReviews: TrustScoreReview[] = entityReviews.map(row => ({
        createdAt: row.created_at,
        reviewerVerified: Boolean(verifiedByAuthor[row.author_id]),
      }));
      const calculated = calculateTrustScore({ averageRating, reviews: scoreReviews });
      scores[id] = { ...calculated, averageRating };

      // Record at most one snapshot per entity per day. The shared TS utility
      // remains the only place where the score formula is calculated.
      if (singularId && calculated.score !== null) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: todaySnapshot } = await db.from("trust_score_snapshots")
          .select("id").eq("target_type", entityType).eq("target_id", id).eq("snapshot_day", today).maybeSingle();
        if (!todaySnapshot) {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
          const { data: previousSnapshot } = await db.from("trust_score_snapshots")
            .select("score,created_at").eq("target_type", entityType).eq("target_id", id)
            .gte("created_at", thirtyDaysAgo).lt("snapshot_day", today)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          const { error: snapshotError } = await db.from("trust_score_snapshots").insert({
            target_type: entityType, target_id: id, score: calculated.score, snapshot_day: today,
          });
          if (!snapshotError && previousSnapshot && Math.abs(Number(previousSnapshot.score) - calculated.score) > 5) {
            const { data: watchers } = await db.from("user_watchlists").select("user_id")
              .eq("target_type", entityType).eq("target_id", id).eq("follow", true)
              .eq("alert_trust_score", true).eq("muted", false);
            const watcherIds = Array.from(new Set((watchers || []).map(row => row.user_id)));
            if (watcherIds.length) {
              const { data: preferences } = await db.from("user_preferences").select("user_id,notifications_enabled")
                .in("user_id", watcherIds);
              const enabledIds = (preferences || []).filter(row => row.notifications_enabled).map(row => row.user_id);
              if (enabledIds.length) {
                await db.from("notifications").insert(enabledIds.map(userId => ({
                  user_id: userId, target_type: entityType, target_id: id, notification_type: "trust_score",
                  title: "Trust Score changed",
                  body: `HoopCheck Trust Score moved from ${previousSnapshot.score} to ${calculated.score} in the last 30 days.`,
                })));
              }
            }
          }
        }
      }
    }

    const headers = { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" };
    if (singularId && ids.length === 1) return NextResponse.json(scores[singularId], { headers });
    return NextResponse.json({ scores }, { headers });
  } catch (error) {
    console.error("Trust Score calculation failed", error);
    return NextResponse.json({ error: "Trust Score could not be calculated right now." }, { status: 500 });
  }
}
