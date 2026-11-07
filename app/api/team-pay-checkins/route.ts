import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getHoopCheckEntitlements } from "../../../lib/membership-tier";

export const dynamic = "force-dynamic";
const statuses = ["on_time", "late", "missing"] as const;
type PayStatus = typeof statuses[number];

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new Error("Pay check-in service is not configured.");
  return {
    auth: createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } }),
    db: createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } }),
  };
}
function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function lastTwelveMonths() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1));
    return d.toISOString().slice(0, 10);
  });
}
function authorized(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId") || "";
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) return NextResponse.json({ error: "Provide a valid team." }, { status: 400 });
  try {
    const token = authorized(request);
    if (!token) return NextResponse.json({ error: "Sign in to view team pay history." }, { status: 401 });
    const { auth, db } = clients();
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: "Sign in to view team pay history." }, { status: 401 });
    const [{ data: viewer, error: viewerError }, { data: viewerSubscription }] = await Promise.all([
      db.from("profiles").select("account_type").eq("id", authData.user.id).maybeSingle(),
      db.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", authData.user.id).maybeSingle(),
    ]);
    if (viewerError) throw viewerError;
    const entitlements = getHoopCheckEntitlements({ accountType: viewer?.account_type, subscription: viewerSubscription });
    if (!entitlements.canViewTeamPayHistory) {
      return NextResponse.json({ error: "Team pay history is not available for this account." }, { status: 403 });
    }
    const months = lastTwelveMonths();
    const { data, error } = await db.from("team_pay_checkins").select("pay_month,pay_status").eq("team_id", teamId).gte("pay_month", months[0]).lte("pay_month", months[11]);
    if (error) throw error;
    const grouped = new Map<string, { total: number; on_time: number; late: number; missing: number }>();
    for (const month of months) {
      const rows = (data || []).filter(row => row.pay_month === month);
      if (rows.length < 3) continue;
      grouped.set(month, {
        total: rows.length,
        on_time: rows.filter(row => row.pay_status === "on_time").length,
        late: rows.filter(row => row.pay_status === "late").length,
        missing: rows.filter(row => row.pay_status === "missing").length,
      });
    }
    // Only aggregate buckets meeting the anonymity threshold leave the server.
    return NextResponse.json({ months: [...grouped.entries()].map(([month, counts]) => ({ month, ...counts })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Pay timeline aggregate failed", error);
    return NextResponse.json({ error: "Pay timeline is temporarily unavailable." }, { status: 503 });
  }
}
export async function POST(request: Request) {
  const token = authorized(request);
  if (!token) return NextResponse.json({ error: "Sign in to submit a pay check-in." }, { status: 401 });
  let body: { teamId?: unknown; month?: unknown; status?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const teamId = typeof body.teamId === "string" ? body.teamId : "";
  const month = typeof body.month === "string" ? body.month : "";
  const status = body.status as PayStatus;
  if (!/^[0-9a-f-]{36}$/i.test(teamId) || !/^\d{4}-\d{2}-01$/.test(month) || !statuses.includes(status)) {
    return NextResponse.json({ error: "Choose a team, month, and valid pay status." }, { status: 400 });
  }
  const months = lastTwelveMonths();
  if (!months.includes(month)) return NextResponse.json({ error: "Check-ins are available for the last 12 months only." }, { status: 400 });
  try {
    const { auth, db } = clients();
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    const user = authData.user;
    if (authError || !user || !user.email_confirmed_at) return NextResponse.json({ error: "A confirmed player account is required." }, { status: 401 });
    const [{ data: profile, error: profileError }, { data: subscription, error: subscriptionError }] = await Promise.all([
      db.from("profiles").select("account_type,player_verified").eq("id", user.id).maybeSingle(),
      db.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", user.id).maybeSingle(),
    ]);
    if (profileError) return NextResponse.json({ error: "Unable to verify your player account." }, { status: 500 });
    const entitlements = getHoopCheckEntitlements({
      accountType: profile?.account_type,
      subscription,
      playerVerified: profile?.player_verified === true,
    });
    if (subscriptionError || !entitlements.canSubmitPayCheckIn) {
      return NextResponse.json({ error: "An active Pro or Premium membership is required to submit a pay check-in." }, { status: 403 });
    }
    const { data: eligible, error: eligibilityError } = await db.rpc("can_user_review_team", { p_user_id: user.id, p_team_id: teamId });
    if (eligibilityError || eligible !== true) return NextResponse.json({ error: "Only players who played for this team can submit a check-in." }, { status: 403 });
    const { error } = await db.from("team_pay_checkins").insert({ team_id: teamId, player_id: user.id, pay_month: month, pay_status: status });
    if (error?.code === "23505") return NextResponse.json({ error: "You already submitted a check-in for this team and month." }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Pay check-in submission failed", error);
    return NextResponse.json({ error: "Unable to submit your check-in right now." }, { status: 503 });
  }
}
