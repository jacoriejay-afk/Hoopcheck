import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
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

  const { count: recentCount, error: rateLimitError } = await supabase
    .from("womens_team_reviews")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (rateLimitError) {
    console.error("Women's review rate-limit lookup failed:", rateLimitError);
    return NextResponse.json({ error: "Unable to submit your review right now." }, { status: 500 });
  }
  if ((recentCount ?? 0) >= 5) {
    return NextResponse.json({ error: "Review limit reached. You can submit up to 5 reviews in a 24-hour period." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
  }

  if (
    typeof body.womens_team_id !== "string" ||
    !body.womens_team_id ||
    body.womens_team_id !== profile.selected_womens_team_id
  ) {
    return NextResponse.json({ error: "You must be verified with this women’s team before reviewing it." }, { status: 403 });
  }

  const ratings = ["overall_rating", "communication_rating", "professionalism_rating", "development_rating", "payment_rating"] as const;
  const ratingValues: Record<string, number> = {};
  for (const key of ratings) {
    const value = Number(body[key]);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      return NextResponse.json({ error: `${key} must be between 1 and 5.` }, { status: 400 });
    }
    ratingValues[key] = value;
  }

  const reviewBody = typeof body.body === "string" ? body.body.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (reviewBody.length < 10 || reviewBody.length > 5000) {
    return NextResponse.json({ error: "Review must be 10–5,000 characters." }, { status: 400 });
  }
  if (title.length > 120) {
    return NextResponse.json({ error: "Review title must be 120 characters or fewer." }, { status: 400 });
  }
  if (/\b(fuck|shit|bitch|cunt|nigger|nigga|porn|xxx|sexcam)\b/i.test(`${reviewBody} ${title}`)) {
    return NextResponse.json({ error: "Review contains prohibited language." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("womens_team_reviews")
    .insert({
      author_id: user.id,
      womens_team_id: body.womens_team_id,
      ...ratingValues,
      title: title || null,
      body: reviewBody,
      status: "pending",
      is_anonymous: body.is_anonymous === true,
    })
    .select("id,status")
    .single();

  if (error) {
    console.error("Women's review insert failed:", error);
    return NextResponse.json({ error: error.code === "42501" ? "You are not authorized to submit this review." : "Unable to submit your review." }, { status: error.code === "42501" ? 403 : 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
