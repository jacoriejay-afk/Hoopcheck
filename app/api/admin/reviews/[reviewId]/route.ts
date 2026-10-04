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

  return NextResponse.json({ success: true });
}
