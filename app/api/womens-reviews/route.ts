import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 16 * 1024) {
    return NextResponse.json({ error: "Review request is too large." }, { status: 413 });
  }
  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > 16 * 1024) {
    return NextResponse.json({ error: "Review request is too large." }, { status: 413 });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
  }

  const reviewInput = body as Record<string, unknown>;
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: "Service configuration is unavailable." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: "Please confirm your email address before submitting a review." }, { status: 403 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("account_type,basketball_type,player_verified,selected_womens_team_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Women's review profile lookup failed:", profileError);
    return NextResponse.json({ error: "Unable to verify your player account." }, { status: 500 });
  }
  if (
    profile?.account_type !== "player" ||
    profile?.basketball_type !== "womens" ||
    profile?.player_verified !== true
  ) {
    return NextResponse.json({ error: "Only verified women’s basketball players can review women’s teams." }, { status: 403 });
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("status,current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (subscriptionError) {
    console.error("Women's review subscription lookup failed:", subscriptionError);
    return NextResponse.json({ error: "Unable to verify your membership." }, { status: 500 });
  }

  const paid = (subscription?.status === "active" || subscription?.status === "trialing") &&
    (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now());
  if (!paid) {
    return NextResponse.json({ error: "An active HoopCheck membership is required to submit ratings or reviews." }, { status: 403 });
  }

  if (
    typeof reviewInput.womens_team_id !== "string" ||
    !reviewInput.womens_team_id ||
    reviewInput.womens_team_id !== profile.selected_womens_team_id
  ) {
    return NextResponse.json({ error: "You must be verified with this women’s team before reviewing it." }, { status: 403 });
  }

  const ratings = ["overall_rating", "communication_rating", "professionalism_rating", "development_rating", "payment_rating"] as const;
  const ratingValues: Record<string, number> = {};
  for (const key of ratings) {
    const value = Number(reviewInput[key]);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      return NextResponse.json({ error: `${key} must be between 1 and 5.` }, { status: 400 });
    }
    ratingValues[key] = value;
  }

  const reviewBody = typeof reviewInput.body === "string" ? reviewInput.body.trim() : "";
  const title = typeof reviewInput.title === "string" ? reviewInput.title.trim() : "";
  if (reviewBody.length < 10 || reviewBody.length > 5000) {
    return NextResponse.json({ error: "Review must be 10–5,000 characters." }, { status: 400 });
  }
  if (title.length > 120) {
    return NextResponse.json({ error: "Review title must be 120 characters or fewer." }, { status: 400 });
  }
  if (/\b(fuck|shit|bitch|cunt|nigger|nigga|porn|xxx|sexcam)\b/i.test(`${reviewBody} ${title}`)) {
    return NextResponse.json({ error: "Review contains prohibited language." }, { status: 400 });
  }

  const { data: reviewSlotId, error: slotError } = await supabase.rpc("claim_review_submission_slot");
  if (slotError) {
    console.error("Atomic women's review rate-limit claim failed:", slotError);
    return NextResponse.json({ error: "Unable to submit your review right now." }, { status: 500 });
  }
  if (typeof reviewSlotId !== "number" || !Number.isSafeInteger(reviewSlotId)) {
    return NextResponse.json({ error: "Review limit reached. You can submit up to 5 reviews in a 24-hour period." }, { status: 429 });
  }

  const { data, error } = await supabase
    .from("womens_team_reviews")
    .insert({
      author_id: user.id,
      womens_team_id: reviewInput.womens_team_id,
      ...ratingValues,
      title: title || null,
      body: reviewBody,
      status: "pending",
      is_anonymous: reviewInput.is_anonymous === true,
    })
    .select("id,status")
    .single();

  if (error) {
    const { error: releaseError } = await supabase.rpc("release_review_submission_slot", { p_slot_id: reviewSlotId });
    if (releaseError) console.error("Unable to release failed women's review slot:", releaseError);
    console.error("Women's review insert failed:", error);
    return NextResponse.json({ error: error.code === "42501" ? "You are not authorized to submit this review." : "Unable to submit your review." }, { status: error.code === "42501" ? 403 : 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
