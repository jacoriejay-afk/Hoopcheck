import { NextResponse } from "next/server";
import { createAuthClient } from "../../../../lib/server/supabase-auth";
import { resolveLeagueSeason } from "../../../../lib/league-season-server";
import type { LeagueSeasonWindow } from "../../../../lib/league-season";

export const dynamic = "force-dynamic";

/**
 * Read-only status lookup. Fail closed on DB errors: callers must not infer
 * that an unverified league is in season.
 */
export async function GET(request: Request) {
  const ids = Array.from(new Set((new URL(request.url).searchParams.get("ids") || "")
    .split(",").filter(Boolean)));
  if (!ids.length || ids.length > 100 ||
      ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    return NextResponse.json({ error: "Provide 1–100 league UUIDs." }, { status: 400 });
  }
  try {
    const db = await createAuthClient();
    const { data, error } = await db.from("leagues")
      .select("id,country,season_start_month,season_start_day,season_end_month,season_end_day,season_label,season_time_zone")
      .in("id", ids);
    if (error) throw error;
    // Country is not a timezone. Use verified league timezone when present;
    // mark UTC fallback as provisional on each individual league.
    const status: Record<string, ReturnType<typeof resolveLeagueSeason> & { timeZone: string; provisionalTimeZone: boolean }> = {};
    for (const row of data || []) {
      const window: LeagueSeasonWindow = {
        season_start_month: row.season_start_month,
        season_start_day: row.season_start_day,
        season_end_month: row.season_end_month,
        season_end_day: row.season_end_day,
        season_label: row.season_label,
      };
      const timeZone = row.season_time_zone || "UTC";
      status[row.id] = {
        ...resolveLeagueSeason(window, new Date(), timeZone),
        timeZone,
        provisionalTimeZone: !row.season_time_zone,
      };
    }
    return NextResponse.json({ status }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "League season status unavailable." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
