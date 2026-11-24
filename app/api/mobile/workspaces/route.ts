import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mobileWorkspaceAccess } from "../../../../lib/ambassador/mobile-access";
import { ambassadorDb } from "../../../../lib/ambassador/server";
import { getOwnerMetrics } from "../../../../lib/owner/metrics";
import { getOwnerStripeSummary } from "../../../../lib/owner/stripe-summary";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: Request) {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") || "");
  if (!match || match[1].length > 16384) return reply({ error: "Authentication required." }, 401);
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "owner" && kind !== "ambassador") return reply({ error: "Unknown workspace." }, 400);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return reply({ error: "Workspace unavailable." }, 503);
  try {
    const scoped = createClient(url, key, { global: { headers: { Authorization: "Bearer " + match[1] } },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
    const { data, error } = await scoped.auth.getUser(match[1]);
    if (error || !data.user) return reply({ error: "Sign in again." }, 401);
    const access = await mobileWorkspaceAccess(scoped, match[1], data.user);
    if (!access[kind]) return reply({ error: "Workspace access could not be verified." }, 403);
    if (kind === "owner") {
      const [metrics, stripe] = await Promise.all([getOwnerMetrics(), getOwnerStripeSummary()]);
      return reply({ kind, owner: data.user.id, metrics, stripe });
    }
    // Never accept a user ID or campaign ID from the caller. The canonical
    // dashboard RPC projects only this authenticated ambassador's ledger.
    const dashboard = await ambassadorDb().rpc("ambassador_dashboard", { p_user: data.user.id });
    if (dashboard.error) return reply({ error: "Workspace unavailable." }, 503);
    if (!dashboard.data) return reply({ error: "Workspace not found." }, 404);
    return reply({ kind, owner: data.user.id, dashboard: dashboard.data });
  } catch { return reply({ error: "Workspace unavailable." }, 503); }
}
