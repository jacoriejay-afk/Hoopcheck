import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateTrustScore } from "../../../../../lib/trust-score";
import { authorizeModeratorRequest } from "../../../../../lib/server/review-moderation";

const reviewStatuses = [
  "approved",
  "rejected",
  "flagged",
  "removed",
] as const;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function notifyTrustScoreMovement(teamId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return;

  const db = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: reviews, error: reviewError } = await db.from("reviews")
    .select("overall_rating,created_at,author_id")
    .eq("team_id", teamId).eq("status", "approved");
  if (reviewError) throw reviewError;
  const rows = reviews || [];
  const authorIds = Array.from(new Set(rows.map(row => row.author_id).filter(Boolean)));
  const verified: Record<string, boolean> = {};
  if (authorIds.length) {
    const { data: profiles, error: profileError } = await db.from("profiles")
      .select("id,player_verified").in("id", authorIds);
    if (profileError) throw profileError;
    for (const profile of profiles || []) verified[profile.id] = profile.player_verified === true;
  }

  const ratings = rows.map(row => Number(row.overall_rating)).filter(value => Number.isFinite(value) && value >= 1 && value <= 5);
  const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
  const result = calculateTrustScore({
    averageRating,
    reviews: rows.map(row => ({ createdAt: row.created_at, reviewerVerified: Boolean(verified[row.author_id]) })),
  });
  if (result.score === null) return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const cutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: baseline, error: baselineError } = await db.from("trust_score_snapshots")
    .select("score,snapshot_day").eq("target_type", "team").eq("target_id", teamId)
    .gte("snapshot_day", cutoff).lt("snapshot_day", today)
    .order("snapshot_day", { ascending: true }).limit(1).maybeSingle();
  if (baselineError) throw baselineError;

  const { data: snapshot, error: snapshotError } = await db.from("trust_score_snapshots")
    .upsert({ target_type: "team", target_id: teamId, score: result.score, snapshot_day: today },
      { onConflict: "target_type,target_id,snapshot_day", ignoreDuplicates: true })
    .select("id").maybeSingle();
  if (snapshotError) throw snapshotError;
  if (!snapshot || !baseline || Math.abs(result.score - Number(baseline.score)) <= 5) return;

  const { data: watchers, error: watcherError } = await db.from("user_watchlists")
    .select("user_id").eq("target_type", "team").eq("target_id", teamId)
    .eq("follow", true).eq("alert_trust_score", true).eq("muted", false);
  if (watcherError) throw watcherError;
  const watcherIds = Array.from(new Set((watchers || []).map(row => row.user_id).filter(Boolean)));
  if (!watcherIds.length) return;
  const { data: preferences, error: preferenceError } = await db.from("user_preferences")
    .select("user_id,notifications_enabled").in("user_id", watcherIds);
  if (preferenceError) throw preferenceError;
  const recipients = (preferences || []).filter(row => row.notifications_enabled).map(row => row.user_id);
  if (!recipients.length) return;

  const direction = result.score > Number(baseline.score) ? "rose" : "fell";
  const { error: notificationError } = await db.from("notifications").insert(recipients.map(user_id => ({
    user_id, target_type: "team", target_id: teamId, notification_type: "trust_score",
    title: "Trust Score changed by more than 5 points",
    body: `The team Trust Score ${direction} from ${baseline.score} to ${result.score} in the last 30 days.`,
  })));
  if (notificationError) throw notificationError;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const auth = await authorizeModeratorRequest(request);
  if (!auth.ok) return auth.response;

  const { reviewId } = await params;
  if (!uuidPattern.test(reviewId)) {
    return NextResponse.json(
      { error: "Invalid review ID." },
      { status: 400 }
    );
  }

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (
    typeof body?.status !== "string" ||
    !reviewStatuses.includes(
      body.status as (typeof reviewStatuses)[number]
    )
  ) {
    return NextResponse.json(
      { error: "Invalid review status." },
      { status: 400 }
    );
  }

  const { data: existingReview, error: existingError } = await (auth.supabase.from("reviews") as any)
    .select("id, status, team_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (existingError) {
    console.error("Error loading review before moderation:", existingError);
    return NextResponse.json({ error: "Unable to load review." }, { status: 500 });
  }

  if (!existingReview) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  const { data, error } = await auth.supabase
    .from("reviews")
    .update({
      status: body.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error updating review status:", error);
    return NextResponse.json(
      { error: "Unable to update review status." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Review not found." },
      { status: 404 }
    );
  }

  const { error: auditError } = await auth.supabase
    .from("review_moderation_events")
    .insert({
      review_id: reviewId,
      actor_id: auth.user.id,
      entity_type: "review",
      from_status: existingReview.status,
      to_status: body.status,
    });

  if (auditError) {
    console.error("Error recording review moderation event:", auditError);
    return NextResponse.json(
      { error: "Review updated, but the moderation audit could not be recorded." },
      { status: 500 }
    );
  }

  if (body.status === "approved" && existingReview.status !== "approved" && existingReview.team_id) {
    try {
      await notifyTrustScoreMovement(existingReview.team_id);
    } catch (trustError) {
      // A missing optional migration must not block review moderation.
      console.error("Trust Score alert could not be evaluated:", trustError);
    }
  }

  return NextResponse.json({ success: true });
}
