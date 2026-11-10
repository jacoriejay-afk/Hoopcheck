import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Poll responses depend on the viewer; never cache errors or successful totals.
function privateResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return privateResponse({ message: "Sign in required." }, 401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !publicKey || !secret) return privateResponse({ message: "Poll results unavailable." }, 503);

    const payload = await request.json().catch(() => null);
    const ids = payload?.post_ids;
    if (!Array.isArray(ids) || ids.length > 30 || ids.some((id: unknown) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
      return privateResponse({ message: "Invalid poll IDs." }, 400);
    }
    const uniqueIds = [...new Set(ids as string[])];

    const viewer = createClient(url, publicKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await viewer.auth.getUser(token);
    if (authError || !authData.user) return privateResponse({ message: "Invalid session." }, 401);
    // Even an empty request must authenticate before returning poll results.
    if (!uniqueIds.length) return privateResponse({ results: {} });

    // RLS filters inaccessible posts before the service-role client can read vote rows.
    const { data: visible, error: visibleError } = await viewer.from("feed_posts")
      .select("id,poll_options,status,expires_at,post_kind").in("id", uniqueIds).eq("status", "approved").eq("post_kind", "poll").gt("expires_at", new Date().toISOString());
    if (visibleError) return privateResponse({ message: "Poll results unavailable." }, 503);
    // A visible poll with malformed options is a data-integrity failure, not
    // an inaccessible poll. Never silently omit it from the response.
    if ((visible || []).some((p) => !Array.isArray(p.poll_options) || p.poll_options.length < 2 || p.poll_options.length > 10 || p.poll_options.some((option: unknown) => typeof option !== "string" || !option.trim() || option.length > 200) || new Set(p.poll_options.map((option: string) => option.trim().toLocaleLowerCase())).size !== p.poll_options.length)) {
      return privateResponse({ message: "Poll results are temporarily unavailable." }, 503);
    }
    const polls = visible || [];
    if (!polls.length) return privateResponse({ results: {} });

    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const results: Record<string, { counts: number[]; total: number; mine: number | null }> = {};
    for (const poll of polls) results[poll.id] = { counts: (poll.poll_options as unknown[]).map(() => 0), total: 0, mine: null };

    // Aggregate page by page instead of accumulating every voter's row in memory.
    // Supabase REST commonly limits a query to 1,000 rows. Never return partial totals.
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data: page, error: voteError } = await admin.from("feed_poll_votes")
        .select("post_id,user_id,option_index")
        .in("post_id", polls.map((p) => p.id))
        .order("post_id", { ascending: true })
        .order("user_id", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (voteError || !page) return privateResponse({ message: "Poll results unavailable." }, 503);
      for (const vote of page) {
        const result = results[vote.post_id];
        // Invalid persisted votes must not silently disappear from totals.
        // Fail closed until the data can be repaired rather than show misleading results.
        if (!result || !Number.isInteger(vote.option_index) || vote.option_index < 0 || vote.option_index >= result.counts.length) {
          return privateResponse({ message: "Poll results are temporarily unavailable." }, 503);
        }
        result.counts[vote.option_index]++;
        result.total++;
        if (vote.user_id === authData.user.id) result.mine = vote.option_index;
      }
      if (page.length < pageSize) break;
      // Hard limit on server-side work; fail closed rather than display incorrect counts.
      if (offset + pageSize >= 100000) return privateResponse({ message: "Poll results are temporarily unavailable." }, 503);
    }
    return privateResponse({ results });
  } catch {
    return privateResponse({ message: "Poll results unavailable." }, 500);
  }
}
