import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateReviewSummary } from "../../../lib/review-summary";
import { getHoopCheckEntitlements } from "../../../lib/membership-tier";
import { exactSeasonReviewsEnabled,listVerifiedReviewSeasons } from "../../../lib/career/verified-review-season";
import { assuranceForVerifiedUser } from "../../../lib/auth/mfa-core";

export const dynamic = "force-dynamic";

const reviewColumns = "id,team_id,coach_id,player_season,overall_rating,communication_rating,professionalism_rating,development_rating,payment_rating,pay_on_time_rating,housing_rating,medical_support_rating,coaching_quality_rating,facilities_rating,playing_time_honesty_rating,title,body,created_at,is_anonymous";
const headers = { "Cache-Control": "private, no-store" };
const denied = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  if (!["team", "coach", "womens-team", "league"].includes(entityType || "") || !entityId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(entityId)) {
    return denied("Provide a valid review target.", 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return denied("Review access service is not configured.", 503);
  }

  try {
    const authorization = request.headers.get("authorization");
    const bearer = authorization?.match(/^Bearer\s+(\S{1,16384})$/i)?.[1];
    if (authorization !== null && !bearer) return denied("Sign in again.", 401);
    const scoped = bearer ? createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }) : null;
    const identity = scoped && bearer ? await scoped.auth.getUser(bearer) : null;
    const user = identity?.data.user;
    if (bearer && (!user?.email_confirmed_at || identity?.error)) return denied("Sign in again.", 401);
    if (bearer && user && assuranceForVerifiedUser(bearer, user).required) return denied("Verify your authenticator to continue.", 403);

    let accountType = "";
    let profile: { account_type?: string; basketball_type?: string | null; player_verified?: boolean; selected_womens_team_id?: string | null; moderation_status?: string } | null = null;
    let subscription: { plan?: string; status?: string; access_status?: string | null; current_period_end?: string | null } | null = null;
    let isAdmin = false;
    if (user && scoped) {
      const [profileResult, subscriptionResult, active, staff] = await Promise.all([
        scoped.from("profiles").select("account_type,basketball_type,player_verified,selected_womens_team_id,moderation_status").eq("id", user.id).maybeSingle(),
        scoped.from("membership_entitlements").select("plan,status,access_status,current_period_end").eq("user_id", user.id).maybeSingle(),
        scoped.rpc("confirm_active_account_session"),
        scoped.rpc("is_current_user_admin_or_moderator"),
      ]);
      if (profileResult.error || subscriptionResult.error || active.error || staff.error) return denied("Review access could not be verified.", 503);
      if (active.data !== true || !profileResult.data || ["suspended", "banned", "removed"].includes(profileResult.data.moderation_status)) {
        return denied("Reviews are unavailable for this account.", 403);
      }
      profile = profileResult.data;
      subscription = subscriptionResult.data;
      accountType = profile?.account_type || "";
      isAdmin = staff.data === true;
    }

    const entitlements = getHoopCheckEntitlements({ accountType, subscription, isAdmin, playerVerified: profile?.player_verified === true });
    // Preserve the established paid-member review access for coaches, agents and club admins.
    const tier = isAdmin ? "premium" :
      accountType && accountType !== "fan" && accountType !== "player" && entitlements.hasPaidMembership ? "member" :
      entitlements.tier;
    const fullRead = entitlements.canReadFullReviews;
    let canWrite = entitlements.canWriteReviews && (
      entityType !== "womens-team" ||
      (profile?.basketball_type === "womens" && profile.selected_womens_team_id === entityId)
    );

    const targetColumn = entityType === "team" ? "team_id" : entityType === "coach" ? "coach_id" : entityType === "league" ? "league_id" : "womens_team_id";
    const table = entityType === "womens-team" ? "womens_team_reviews" : "reviews";

    const exactSeasonRequired = exactSeasonReviewsEnabled() && (entityType === "team" || entityType === "womens-team");
    let verifiedSeasons: string[] = [];
    if (exactSeasonRequired) {
      // The submission routes do not grant a membership bypass to administrators.
      const writer = getHoopCheckEntitlements({accountType,subscription,playerVerified:profile?.player_verified===true});
      canWrite = Boolean(user?.email_confirmed_at && writer.canWriteReviews && (entityType !== "womens-team" || profile?.basketball_type === "womens"));
      if (canWrite && user && scoped) {
        verifiedSeasons = await listVerifiedReviewSeasons(scoped,user.id,entityId,entityType==="team"?"teams":"womens_teams",new Date().getUTCFullYear());
        canWrite=verifiedSeasons.length>0;
      }
    } else if (canWrite && entityType === "team" && user && scoped) {
      const { data: eligible, error: eligibilityError } = await scoped.rpc("can_user_review_team", {
        p_user_id: user.id,
        p_team_id: entityId,
      });
      if (eligibilityError) throw eligibilityError;
      canWrite = eligible === true;
    }

    const response: Record<string, unknown> = {
      accountType,
      tier,
      canWrite,
      canReadFull: fullRead,
      ...(exactSeasonRequired ? { exactSeasonRequired:true, verifiedSeasons } : {}),
      categories: ["Communication", "Professionalism", "Development", "Payment", "Pay on time", "Housing", "Medical support", "Coaching quality", "Facilities", "Playing time honesty"],
      summary: null,
      reviews: [],
    };

    if (tier === "free") {
      return NextResponse.json(response, { headers });
    }

    const db = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: rawRows, error: rowsError } = await db.from(table)
      .select(fullRead ? (entityType === "womens-team" ? "id,title,body,overall_rating,created_at,is_anonymous" : reviewColumns) : "overall_rating")
      .eq(targetColumn, entityId).eq("status", "approved")
      .order("created_at", { ascending: false });
    if (rowsError) throw rowsError;
    const rows = (rawRows || []) as unknown as Array<Record<string, unknown>>;
    const summary = calculateReviewSummary(rows, fullRead && entityType !== "womens-team");
    response.summary = {
      overall_rating: summary.overall_rating,
      review_count: fullRead ? summary.review_count : undefined,
      communication_rating: fullRead && entityType !== "womens-team" ? summary.communication_rating : undefined,
      professionalism_rating: fullRead && entityType !== "womens-team" ? summary.professionalism_rating : undefined,
      development_rating: fullRead && entityType !== "womens-team" ? summary.development_rating : undefined,
      payment_rating: fullRead && entityType !== "womens-team" ? summary.payment_rating : undefined,
    };
    if (fullRead) response.reviews = rows;

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error("Review access lookup failed", { code: (error as { code?: string } | null)?.code });
    return denied("Review access could not be loaded.", 500);
  }
}
