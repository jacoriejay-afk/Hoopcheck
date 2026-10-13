import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type ProviderTeam = { id?: number; name?: string };
type ProviderScore = { total?: number | null; points?: number | null };
type ProviderGame = {
  id: number | string;
  date?: string;
  timestamp?: number;
  status?: { short?: string; long?: string };
  teams?: { home?: ProviderTeam; visitors?: ProviderTeam };
  scores?: { home?: ProviderScore; visitors?: ProviderScore };
};
type ProviderResponse = { response?: ProviderGame[]; errors?: unknown; results?: number };

function score(value?: ProviderScore): number | null {
  const n = value?.total ?? value?.points;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  const secret = process.env.LIVE_SCORES_CRON_SECRET;
  const supplied = request.headers.get("authorization");
  if (!secret || supplied !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const apiKey = process.env.API_SPORTS_BASKETBALL_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Live-score sync is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const db = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const bakuDateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baku",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const datePart = (type: string) => bakuDateParts.find(part => part.type === type)?.value;
    const fixtureDate = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
    const response = await fetch(`https://v1.basketball.api-sports.io/games?date=${fixtureDate}&timezone=Asia%2FBaku`, {
      headers: { "x-apisports-key": apiKey, "Accept": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Basketball data provider returned an error." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const payload = await response.json() as ProviderResponse;
    if (!Array.isArray(payload.response) || (Array.isArray(payload.errors) && payload.errors.length > 0)) {
      return NextResponse.json({ error: "Basketball data provider returned an invalid response." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const { data: mappings, error: mappingError } = await db
      .from("fan_live_team_provider_map")
      .select("team_id,provider_team_id")
      .eq("active", true);
    if (mappingError) throw mappingError;

    const byProviderId = new Map<number, string>();
    for (const mapping of mappings || []) byProviderId.set(Number(mapping.provider_team_id), mapping.team_id);

    // Name matching gives the integration a useful default before manual aliases
    // are configured. Explicit provider-ID mappings always take precedence.
    const { data: teams, error: teamsError } = await db.from("teams").select("id,name");
    if (teamsError) throw teamsError;
    const normalize = (name: string) => name.toLocaleLowerCase("en-US").replace(/\b(basketball club|basketball|bc|club|team)\b/g, " ").replace(/[^a-z0-9]/g, "");
    const internalTeamByName = new Map<string, string>();
    const ambiguousTeamNames = new Set<string>();
    for (const team of teams || []) {
      if (typeof team.name === "string" && team.name.trim()) {
        const key = normalize(team.name);
        if (!key || ambiguousTeamNames.has(key)) continue;
        if (internalTeamByName.has(key)) {
          // Never assign a provider game to an arbitrary duplicate team record.
          internalTeamByName.delete(key);
          ambiguousTeamNames.add(key);
        } else {
          internalTeamByName.set(key, team.id);
        }
      }
    }
    // Learn provider IDs from date-scoped fixtures only when the normalized name maps to
    // exactly one internal team. This discovers verified IDs before games tip off; never overwrite mappings or guess IDs.
    const mappedInternalIds = new Set((mappings || []).map((mapping: { team_id: string }) => mapping.team_id));
    const discovered = new Map<number, { team_id: string; provider_team_name: string; active: true }>();
    for (const game of payload.response) {
      const sides = [game.teams?.home, game.teams?.visitors];
      for (const side of sides) {
        const providerId = Number(side?.id);
        const providerName = side?.name;
        if (!Number.isInteger(providerId) || providerId <= 0 || !providerName) continue;
        if (byProviderId.has(providerId) || discovered.has(providerId)) continue;
        const internalId = internalTeamByName.get(normalize(providerName));
        if (!internalId || mappedInternalIds.has(internalId)) continue;
        discovered.set(providerId, {
          team_id: internalId,
          provider_team_name: providerName,
          active: true
        });
        mappedInternalIds.add(internalId);
      }
    }

    if (discovered.size) {
      const newMappings = [...discovered.entries()].map(([provider_team_id, value]) => ({
        provider_team_id,
        ...value
      }));
      const { error: insertMappingsError } = await db
        .from("fan_live_team_provider_map")
        .insert(newMappings);
      // If a concurrent run won a uniqueness race, continue safely without
      // replacing either team's existing association.
      if (insertMappingsError && insertMappingsError.code !== "23505") throw insertMappingsError;
      for (const [providerId, value] of discovered.entries()) {
        byProviderId.set(providerId, value.team_id);
      }
    }

    const internalIdFor = (providerId: number, providerName?: string) =>
      byProviderId.get(providerId) || (providerName ? internalTeamByName.get(normalize(providerName)) : undefined);

    const activeStatuses = new Set(["Q1", "Q2", "Q3", "Q4", "OT", "BT", "HT"]);
    const liveGames = payload.response.filter(game => activeStatuses.has(String(game.status?.short || "").toUpperCase()));

    const rows = [];
    for (const game of liveGames) {
      const homeProviderId = Number(game.teams?.home?.id);
      const awayProviderId = Number(game.teams?.visitors?.id);
      const homeInternalId = internalIdFor(homeProviderId, game.teams?.home?.name);
      const awayInternalId = internalIdFor(awayProviderId, game.teams?.visitors?.name);
      if (!homeInternalId && !awayInternalId) continue;

      // Use the followed/mapped side as the primary team so score order is always
      // primary-team score first, opponent score second in the chat UI.
      const primaryIsHome = Boolean(homeInternalId);
      const primaryId = homeInternalId || awayInternalId;
      const opponentId = primaryIsHome ? awayInternalId || null : homeInternalId || null;
      const opponentName = primaryIsHome ? game.teams?.visitors?.name : game.teams?.home?.name;
      const primaryScore = primaryIsHome ? score(game.scores?.home) : score(game.scores?.visitors);
      const opponentScore = primaryIsHome ? score(game.scores?.visitors) : score(game.scores?.home);
      if (!primaryId || !opponentName || !game.id) continue;

      const startDate = game.timestamp ? new Date(game.timestamp * 1000).toISOString()
        : (game.date && !Number.isNaN(Date.parse(game.date)) ? new Date(game.date).toISOString() : null);
      rows.push({
        team_id: primaryId,
        opponent_team_id: opponentId,
        opponent_name: opponentName,
        provider_source: "api-sports-basketball",
        provider_game_id: String(game.id),
        status: "live",
        home_score: primaryScore,
        away_score: opponentScore,
        started_at: startDate
      });
    }

    if (rows.length) {
      const { error: upsertError } = await db.from("fan_live_games")
        .upsert(rows, { onConflict: "provider_source,provider_game_id" });
      if (upsertError) throw upsertError;
    }

    // Close old provider-backed live rows only after a successful provider response.
    const staleBefore = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    let staleQuery = db.from("fan_live_games").update({ status: "final" })
      .eq("provider_source", "api-sports-basketball").eq("status", "live").lt("started_at", staleBefore);
    const liveIds = rows.map(row => row.provider_game_id);
    if (liveIds.length) staleQuery = staleQuery.not("provider_game_id", "in", `(${liveIds.map(id => `"${id.replace(/"/g, "")}"`).join(",")})`);
    const { error: staleError } = await staleQuery;
    if (staleError) throw staleError;

    return NextResponse.json({ ok: true, fixtureDate, providerGamesForDate: payload.response.length, providerLiveGames: liveGames.length, matchedGames: rows.length }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    // Keep detailed diagnostics in server logs only; never expose provider or database details to callers.
    if (error && typeof error === "object") {
      const e = error as { name?: unknown; message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
      console.error("Live-score sync failed", {
        name: e.name,
        message: e.message,
        code: e.code,
        details: e.details,
        hint: e.hint
      });
    } else {
      console.error("Live-score sync failed", String(error));
    }
    return NextResponse.json({ error: "Live-score sync failed. Check server logs." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
