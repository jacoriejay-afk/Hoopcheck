import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reportReasons = [
  "Spam or advertising",
  "Harassment or abusive content",
  "False or misleading information",
  "Personal information",
  "Threats or dangerous content",
  "Other",
] as const;

export async function POST(req: Request) {
  const authorization = req.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];

  if (!token) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Review report API is missing Supabase configuration.");
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > 8_192) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 8_192) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const reviewId = typeof payload.review_id === "string" ? payload.review_id.trim() : "";
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";

  if (!UUID_RE.test(reviewId)) {
    return NextResponse.json({ error: "A valid review ID is required." }, { status: 400 });
  }
  if (!reportReasons.includes(reason as (typeof reportReasons)[number])) {
    return NextResponse.json({ error: "Select a valid report reason." }, { status: 400 });
  }

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id")
    .eq("id", reviewId)
    .eq("status", "approved")
    .maybeSingle();

  if (reviewError) {
    console.error("Review report lookup failed:", reviewError);
    return NextResponse.json({ error: "Unable to verify the review." }, { status: 500 });
  }
  if (!review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("review_reports")
    .insert({
      review_id: reviewId,
      reporter_id: user.id,
      reason,
      status: "open",
    })
    .select("id,status,created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "You have already reported this review." }, { status: 409 });
    }
    if (error.code === "23503") {
      return NextResponse.json({ error: "That review could not be found." }, { status: 404 });
    }
    console.error("Review report insert failed:", error);
    return NextResponse.json({ error: "We couldn't submit your report. Please try again." }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
