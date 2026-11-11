import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveLeagueSeason } from "../../../../../lib/league-season-server";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = ["season_start_month","season_start_day","season_end_month","season_end_day"] as const;

function validDate(month: number, day: number) {
  return Number.isInteger(month) && month >= 1 && month <= 12 &&
    Number.isInteger(day) && day >= 1 && day <= new Date(Date.UTC(2024, month, 0)).getUTCDate();
}

async function context(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new Error("Server not configured");
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) return null;
  const { data: admin, error: adminError } = await userClient.rpc("is_current_user_admin_or_moderator");
  if (adminError || !admin) return null;
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  return { db };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "Invalid league ID" }, { status: 400 });
  try {
    const auth = await context(request);
    if (!auth) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    const raw = await request.text();
    if (raw.length > 2048) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    const input = body as Record<string, unknown>;
    const allowed = new Set<string>([...fields, "season_label", "season_time_zone"]);
    if (Object.keys(input).some(key => !allowed.has(key))) return NextResponse.json({ error: "Unexpected fields" }, { status: 400 });
    const { data: existing, error: readError } = await auth.db.from("leagues").select("season_start_month,season_start_day,season_end_month,season_end_day,season_label,season_time_zone").eq("id", id).single();
    if (readError || !existing) return NextResponse.json({ error: "League not found" }, { status: 404 });
    const next: Record<string, unknown> = { ...existing, ...input };
    for (const field of fields) if (!Number.isInteger(next[field])) return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
    const sm = next.season_start_month as number, sd = next.season_start_day as number;
    const em = next.season_end_month as number, ed = next.season_end_day as number;
    if (!validDate(sm, sd) || !validDate(em, ed) || (sm === em && sd === ed)) return NextResponse.json({ error: "Invalid season dates" }, { status: 400 });
    const zone = next.season_time_zone;
    if (zone !== null && (typeof zone !== "string" || zone.length > 80)) return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    if (zone) {
      try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(new Date()); }
      catch { return NextResponse.json({ error: "Use a valid IANA timezone" }, { status: 400 }); }
    }
    if (next.season_label !== null && (typeof next.season_label !== "string" || next.season_label.length > 40)) return NextResponse.json({ error: "Invalid season label" }, { status: 400 });
    const { data, error } = await auth.db.from("leagues").update(next).eq("id", id).select("id,season_start_month,season_start_day,season_end_month,season_end_day,season_label,season_time_zone").single();
    if (error) throw error;
    const status = resolveLeagueSeason(data, new Date(), data.season_time_zone || "UTC");
    return NextResponse.json({ league: data, preview: status, provisionalTimeZone: !data.season_time_zone }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to save league season" }, { status: 500 });
  }
}
