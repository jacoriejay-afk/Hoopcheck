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

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 16 * 1024) {
    return NextResponse.json({ error: "Report request is too large." }, { status: 413 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 16 * 1024) {
    return NextResponse.json({ error: "Report request is too large." }, { status: 413 });
  }

  let body: { reviewId?: unknown; reason?: unknown };
  try {
    body = JSON.parse(rawBody);
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

  const db = auth.supabase as any;
  const { data: review, error: reviewError } = await db
    .from("reviews")
    .select("id,author_id,title,body")
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
  const { error: queueError } = await db.from("content_reports").insert({
    content_type: "review",
    content_id: body.reviewId,
    reporter_id: auth.user.id,
    content_owner_id: review.author_id,
    content_snapshot: [review.title, review.body].filter(Boolean).join("\\n").slice(0, 6000),
    reason: body.reason,
    status: "open",
  });
  if (queueError && queueError.code !== "23505") {
    console.error("Unified review report insert failed:", queueError);
    return NextResponse.json({ error: "Unable to submit your report." }, { status: 500 });
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
