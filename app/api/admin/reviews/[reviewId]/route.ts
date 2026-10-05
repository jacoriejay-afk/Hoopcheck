import { NextResponse } from "next/server";
import { authorizeModeratorRequest } from "../../../../../lib/server/review-moderation";

const reviewStatuses = [
  "approved",
  "rejected",
  "flagged",
  "removed",
] as const;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const { data: existingReview, error: existingError } = await auth.supabase
    .from("reviews")
    .select("id, status")
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

  return NextResponse.json({ success: true });
}
