import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const reviewColumns = "id,team_id,coach_id,player_season,overall_rating,communication_rating,professionalism_rating,development_rating,payment_rating,pay_on_time_rating,housing_rating,medical_support_rating,coaching_quality_rating,facilities_rating,playing_time_honesty_rating,title,body,created_at,is_anonymous,author_id";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  if (!["team", "coach", "womens-team"].includes(entityType || "") || !entityId || !/^[0-9a-f-]{36}$/i.test(entityId)) {
    return NextResponse.json({ error: "Provide a valid review target." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Review access service is not configured." }, { status: 503 });
  }

  try {
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: authData } = bearer ? await authClient.auth.getUser(bearer) : { data: { user: null } };
    const user = authData.user;
    const db = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    let accountType = "";
    let plan = "";
    let active = false;
    let isAdmin = false;
    if (user) {
      const [{ data: profile }, { data: subscription }] = await Promise.all([
        db.from("profiles").select("account_type").eq("id", user.id).maybeSingle(),
        db.from("subscriptions").select("plan,status,current_period_end").eq("user_id", user.id).maybeSingle(),
      ]);
      accountType = profile?.account_type || "";
      plan = subscription?.plan || "";
      active = ["active", "trialing"].includes(subscription?.status || "") &&
        (!subscription?.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now());
      const { data: admin } = await authClient.auth.getUser(bearer);
      if (admin.user) {
        const scoped = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: "Bearer " + bearer } },
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data } = await scoped.rpc("is_current_user_admin_or_moderator");
        isAdmin = data === true;
      }
    }

    const tier = isAdmin ? "premium" :
      accountType === "player" ? (active ? "player" : "free") :
      accountType === "fan" && active && plan === "premium" ? "premium" :
      accountType === "fan" && active && plan === "pro" ? "pro" :
      accountType !== "fan" && accountType !== "" && active ? "member" : "free";
    const fullRead = ["premium", "player", "member"].includes(tier);
    const targetColumn = entityType === "team" ? "team_id" : entityType === "coach" ? "coach_id" : "womens_team_id";
    const table = entityType === "womens-team" ? "womens_team_reviews" : "reviews";

    const response: Record<string, unknown> = {
      tier,
      canWrite: accountType === "player" && active && entityType !== "womens-team",
      categories: ["Communication", "Professionalism", "Development", "Payment", "Pay on time", "Housing", "Medical support", "Coaching quality", "Facilities", "Playing time honesty"],
      summary: null,
      reviews: [],
    };

    if (tier === "free") {
      return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (entityType === "womens-team") {
      const { data: summary, error: summaryError } = await db.rpc("get_womens_review_rating_summary", { p_team_id: entityId });
      if (summaryError) throw summaryError;
      const row = Array.isArray(summary) ? summary[0] : null;
      response.summary = row ? { overall_rating: row.overall_rating == null ? null : Number(row.overall_rating), review_count: fullRead ? Number(row.review_count || 0) : undefined } : null;
      if (fullRead) {
        const { data, error } = await db.from(table).select("id,title,body,overall_rating,created_at,is_anonymous").eq(targetColumn, entityId).eq("status", "approved").order("created_at", { ascending: false });
        if (error) throw error;
        response.reviews = data || [];
      }
    } else {
      const { data: summary, error: summaryError } = await db.rpc("get_public_review_summary", { p_entity_type: entityType, p_entity_id: entityId });
      if (summaryError) throw summaryError;
      const row = Array.isArray(summary) ? summary[0] : null;
      response.summary = row ? {
        overall_rating: row.overall_rating == null ? null : Number(row.overall_rating),
        review_count: fullRead ? Number(row.review_count || 0) : undefined,
        communication_rating: fullRead ? row.communication_rating : undefined,
        professionalism_rating: fullRead ? row.professionalism_rating : undefined,
        development_rating: fullRead ? row.development_rating : undefined,
        payment_rating: fullRead ? row.payment_rating : undefined,
      } : null;
      if (fullRead) {
        const { data, error } = await db.from("reviews").select(reviewColumns).eq(targetColumn, entityId).eq("status", "approved").order("created_at", { ascending: false });
        if (error) throw error;
        response.reviews = data || [];
      }
    }

    return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Review access lookup failed", error);
    return NextResponse.json({ error: "Review access could not be loaded." }, { status: 500 });
  }
}
