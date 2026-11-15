import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Read-only provider smoke test. No games are written until coverage,
// team matching, and duplicate protection are validated in preview.
export async function GET(request: NextRequest) {
  const secret = process.env.LIVE_SCORES_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) return NextResponse.json({ error: "BALLDONTLIE is not configured" }, { status: 503 });

  const today = new Date().toISOString().slice(0, 10);
  const url = new URL("https://api.balldontlie.io/v1/games");
  url.searchParams.append("dates[]", today);
  url.searchParams.set("per_page", "100");
  try {
    const response = await fetch(url, {
      headers: { Authorization: key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      return NextResponse.json({ ok: false, providerStatus: response.status }, { status: 502 });
    }
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) {
      return NextResponse.json({ ok: false, error: "Invalid provider response" }, { status: 502 });
    }
    const games = payload.data as Array<{ status_state?: string }>;
    return NextResponse.json({
      ok: true,
      provider: "balldontlie-nba",
      date: today,
      games: games.length,
      statuses: games.reduce<Record<string, number>>((counts, game) => {
        const status = game.status_state || "unknown";
        counts[status] = (counts[status] || 0) + 1;
        return counts;
      }, {}),
      persisted: false,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "Provider request failed" }, { status: 502 });
  }
}
