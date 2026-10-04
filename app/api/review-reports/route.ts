import { NextResponse } from "next/server";
import { authenticateModerationRequest } from "../../../lib/server/review-moderation";

const reportReasons = [
  "Spam or advertising",
  "Harassment or abusive content",
  "False or misleading information",
  "Personal information",
  "Threats or dangerous content",
  "Other",
] as const;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const auth = await authenticateModerationRequest(request);
  if (!auth.ok) return auth.response;

  let body: { reviewId?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (
    typeof body?.reviewId !== "string" ||
    !uuidPattern.test(body.reviewId)
  ) {
    return NextResponse.json(
      { error: "Invalid review ID." },
      { status: 400 }
    );
  }

  if (
    typeof body.reason !== "string" ||
    !reportReasons.includes(
      body.reason as (typeof reportReasons)[number]
    )
  ) {
    return NextResponse.json(
      { error: "Select a valid report reason." },
      { status: 400 }
    );
  }

  const { data: review, error: reviewError } = await auth.supabase
    .from("reviews")
    .select("id")
    .eq("id", body.reviewId)
    .eq("status", "approved")
    .maybeSingle();

  if (reviewError) {
    console.error("Unable to verify reported review:", reviewError);
    return NextResponse.json(
      { error: "Unable to verify the review." },
      { status: 500 }
    );
  }

  if (!review) {
    return NextResponse.json(
      { error: "Review not found." },
      { status: 404 }
    );
  }

  const { error } = await auth.supabase
    .from("review_reports")
    .insert({
      review_id: body.reviewId,
      reporter_id: auth.user.id,
      reason: body.reason,
      status: "open",
    });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You have already reported this review." },
        { status: 409 }
      );
    }

    console.error("Error submitting review report:", error);
    return NextResponse.json(
      { error: "Unable to submit your report." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
