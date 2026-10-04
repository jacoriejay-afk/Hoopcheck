import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REASON_LENGTH = 1000;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const reviewId = typeof payload.review_id === "string" ? payload.review_id.trim() : "";
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";

  if (!UUID_RE.test(reviewId)) {
    return NextResponse.json({ error: "A valid review ID is required." }, { status: 400 });
  }

  if (!reason) {
    return NextResponse.json({ error: "A report reason is required." }, { status: 400 });
  }

  if (reason.length > MAX_REASON_LENGTH) {
    return NextResponse.json(
      { error: `Report reason must be ${MAX_REASON_LENGTH} characters or fewer.` },
      { status: 400 }
    );
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
    console.error("Review report insert failed:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You have already reported this review." },
        { status: 409 }
      );
    }

    if (error.code === "23503") {
      return NextResponse.json({ error: "That review could not be found." }, { status: 404 });
    }

    return NextResponse.json(
      { error: "We couldn't submit your report. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}
