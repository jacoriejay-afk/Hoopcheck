import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GAME_CHAT_OPEN_EARLY_MINUTES } from "../../../../lib/game-availability";
import { selectFixtureSyncDay } from "../../../../lib/live-score-schedule";
import { validatedProviderScore, validateProviderSnapshot, providerTipoff } from "../../../../lib/hoopdata-ingestion";
import { retryAfterTime } from "../../../../lib/hoopdata-provider-fetch";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type ProviderTeam = { id?: number; name?: string };
type ProviderScore = { total?: number | null; points?: number | null };
type ProviderGame = {
  id: number | string;
  date?: string;
  timestamp?: number;
  status?: { short?: string; long?: string };
  league?: { id?: number; name?: string; country?: string };
  country?: { id?: number; name?: string };
  teams?: { home?: ProviderTeam; away?: ProviderTeam; visitors?: ProviderTeam };
  scores?: { home?: ProviderScore; away?: ProviderScore; visitors?: ProviderScore };
};
type ProviderResponse = { response?: ProviderGame[]; errors?: unknown; results?: number };

const providerSource = "api-sports-basketball";

function score(value?: ProviderScore): number | null {
  const n = value?.total ?? value?.points;
  const validated = validatedProviderScore(n);
  return validated !== null && validated <= 2147483647 ? validated : null;
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
  // An API subscription grants feed access. Only competitions covered by
  // HoopCheck's documented publication rights may be imported.
  const approvedLeagueIds = (process.env.API_SPORTS_APPROVED_BASKETBALL_LEAGUE_IDS ?? "")
    .split(",").map(value => value.trim());
  if (approvedLeagueIds.some(id => !/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id)))) {
    return NextResponse.json({ error: "Approved basketball coverage is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const approvedLeagues = new Set(approvedLeagueIds.map(Number));

  try {
    const db = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    // Preserve the existing free-tier provider budget: ONE date per trigger.
    // A small number of existing 15-minute slots fetch future fixtures
    // and yesterday's corrected finals; the rest refresh today's scores.
    const { date: fixtureDate, dayOffset } = selectFixtureSyncDay();
    // Activation is explicit and separate from deployment. Never increase the legacy
    // schedule until the durable quota ledger has been rehearsed and approved.
    const quotaGuard = process.env.HOOPDATA_QUOTA_GUARD_ENABLED === "true";
    if (quotaGuard) {
      const { data: reserved, error: reservationError } = await db.rpc("hoopdata_reserve_request", { p_pool: "api-sports-basketball" });
      if (reservationError) return NextResponse.json({ error: "Provider quota unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
      if (reserved !== true) return NextResponse.json({ error: "Provider quota or cooldown blocked this request." }, { status: 429, headers: { "Cache-Control": "no-store" } });
    }
    const persistCooldown = async (header: string | null) => {
      if (!quotaGuard) return;
      const { data, error } = await db.rpc("hoopdata_block_provider", { p_pool: "api-sports-basketball", p_until: retryAfterTime(header, new Date()) });
      if (error || data !== true) throw Error("Provider cooldown unavailable");
    };
    const response = await fetch(`https://v1.basketball.api-sports.io/games?date=${fixtureDate}&timezone=Asia%2FBaku`, {
      headers: { "x-apisports-key": apiKey, "Accept": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      redirect: "error"
    }).catch(async () => { await persistCooldown(null); throw Error("Provider request failed"); });
    if (!response.ok) {
      if (response.status === 408 || response.status === 429 || response.status >= 500) await persistCooldown(response.headers.get("Retry-After"));
      return NextResponse.json({ error: "Basketball data provider returned an error." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const payload = await response.json().catch(() => null) as ProviderResponse | null;
    if (!payload || !Array.isArray(payload.response) || (Array.isArray(payload.errors) ? payload.errors.length > 0 :
      payload.errors && typeof payload.errors === "object" ? Object.keys(payload.errors).length > 0 :
      Boolean(payload.errors))) {
      return NextResponse.json({ error: "Basketball data provider returned an invalid response." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    // Reject duplicate/malformed provider identities before any mapping or fixture write.
    if (!validateProviderSnapshot(payload.response)) {
      return NextResponse.json({ error: "Basketball provider snapshot contains invalid or duplicate game identities." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    const receivedAt = new Date().toISOString();
    const games = payload.response.filter(game =>
      typeof game.league?.id === "number" && approvedLeagues.has(game.league.id));
    // Only reviewed active mappings can assign a provider fixture to a club.
    // A matching name and country are insufficient evidence of identity.
    const byProviderId = new Map<number, string>();
    for (let offset = 0; offset < 10000; offset += 500) {
      const { data, error } = await db.from("fan_live_team_provider_map")
        .select("team_id,provider_team_id").eq("active", true)
        .order("provider_team_id").range(offset, offset + 499);
      if (error) throw error;
      for (const mapping of data || []) {
        const providerId = Number(mapping.provider_team_id);
        if (!Number.isSafeInteger(providerId) || providerId <= 0 || byProviderId.has(providerId)) {
          throw Error("Invalid or duplicate provider team mapping");
        }
        byProviderId.set(providerId, mapping.team_id);
      }
      if ((data || []).length < 500) break;
      if (offset === 9500) throw Error("Mapping page limit reached");
    }

    const countryOf = (game: ProviderGame) => {
      const country = game.country?.name;
      if (typeof country === "string" && country.trim()) return country.trim();
      return typeof game.league?.country === "string" ? game.league.country.trim() || null : null;
    };
    const liveStatuses = new Set(["Q1", "Q2", "Q3", "Q4", "OT", "BT", "HT"]);
    const scheduledStatuses = new Set(["NS", "TBD"]);
    const finalStatuses = new Set(["FT", "AOT", "AP", "AWD"]);
    const cancelledStatuses = new Set(["POST", "CANC", "ABD", "SUSP"]);
    const statusOf = (game: ProviderGame) => String(game.status?.short || "").toUpperCase();
    const liveGames = games.filter(game => liveStatuses.has(statusOf(game)));
    const trackedGames = games.filter(game =>
      liveStatuses.has(statusOf(game)) || scheduledStatuses.has(statusOf(game)) ||
      finalStatuses.has(statusOf(game)) || cancelledStatuses.has(statusOf(game))
    );

    const rows = [];
    const missingMatchupMappings: {providerGameId:string; providerTeamId:number|null; providerTeamName:string|null; leagueId:number|null}[] = [];
    let incompleteMatchups = 0;
    for (const game of trackedGames) {
      const homeProviderId = Number(game.teams?.home?.id);
      const awayProviderId = Number((game.teams?.away ?? game.teams?.visitors)?.id);
      const homeInternalId = byProviderId.get(homeProviderId);
      const awayInternalId = byProviderId.get(awayProviderId);
      if (homeInternalId && homeInternalId === awayInternalId) continue;
      if (!homeInternalId && !awayInternalId) continue;

      // Use the followed/mapped side as the primary team so score order is always
      // primary-team score first, opponent score second in the chat UI.
      const primaryIsHome = Boolean(homeInternalId);
      const primaryId = homeInternalId || awayInternalId;
      const opponentId = primaryIsHome ? awayInternalId || null : homeInternalId || null;
      const opponentName = primaryIsHome ? (game.teams?.away ?? game.teams?.visitors)?.name : game.teams?.home?.name;
      const primaryScore = primaryIsHome ? score(game.scores?.home) : score((game.scores?.away ?? game.scores?.visitors));
      const opponentScore = primaryIsHome ? score((game.scores?.away ?? game.scores?.visitors)) : score(game.scores?.home);
      if (!primaryId || typeof opponentName !== "string" || !opponentName.trim()) continue;
      if (!opponentId && scheduledStatuses.has(statusOf(game))) {
        incompleteMatchups++;
        const missingId = primaryIsHome ? awayProviderId : homeProviderId;
        if (missingMatchupMappings.length < 20) missingMatchupMappings.push({providerGameId:String(game.id),providerTeamId:Number.isSafeInteger(missingId)&&missingId>0?missingId:null,providerTeamName:opponentName.slice(0,120),leagueId:typeof game.league?.id==="number"?game.league.id:null});
      }

      const startDate = providerTipoff(game.timestamp, game.date);
      // Do not create an undated fixture or overwrite a known tip-off with bad input.
      if (!startDate) continue;
      const providerLeagueId = game.league?.id;
      const providerStatus = statusOf(game);
      const storedStatus = liveStatuses.has(providerStatus) ? "live"
        : scheduledStatuses.has(providerStatus) ? "scheduled"
        : finalStatuses.has(providerStatus) ? "final"
        : providerStatus === "POST" || providerStatus === "SUSP" ? "postponed"
        : providerStatus === "ABD" ? "abandoned" : "cancelled";
      rows.push({
        team_id: primaryId,
        opponent_team_id: opponentId,
        opponent_name: opponentName,
        provider_source: providerSource,
        provider_game_id: String(game.id),
        provider_league_id: typeof providerLeagueId === "number" && Number.isSafeInteger(providerLeagueId) && providerLeagueId > 0 ? providerLeagueId : null,
        status: storedStatus,
        score_updated_at: receivedAt,
        home_score: storedStatus === "scheduled" || storedStatus === "postponed" || storedStatus === "cancelled" || storedStatus === "abandoned" ? null : primaryScore,
        away_score: storedStatus === "scheduled" || storedStatus === "postponed" || storedStatus === "cancelled" || storedStatus === "abandoned" ? null : opponentScore,
        started_at: storedStatus === "live" || storedStatus === "final" ? startDate : null,
        // Only a genuine provider terminal event receives a completion time.
        // A later provider correction to live/scheduled clears a stale end.
        ends_at: null as string | null,
        scheduled_at: startDate,
        league_name: game.league?.name || null,
        country: countryOf(game),
        period_label: liveStatuses.has(providerStatus) ? (game.status?.long || providerStatus) : null
      });
    }

    // Preserve the first provider-confirmed final timestamp. Repeated 15-minute
    // syncs must not keep reopening a two-hour post-game conversation window.
    // A missing fixture or elapsed tipoff is NEVER evidence of a final score.
    const finalized = rows.filter(row => row.status === "final");
    if (finalized.length) {
      const providerIds = finalized.map(row => row.provider_game_id);
      const { data: previous, error: previousError } = await db
        .from("fan_live_games")
        .select("provider_game_id,ends_at")
        .eq("provider_source", providerSource)
        .in("provider_game_id", providerIds);
      if (previousError) throw previousError;
      const endingByProviderId = new Map((previous || []).map(row => [row.provider_game_id, row.ends_at]));
      const confirmedAt = new Date().toISOString();
      for (const row of finalized) {
        row.ends_at = endingByProviderId.get(row.provider_game_id) || confirmedAt;
      }
    }

    if (rows.length) {
      const { error: upsertError } = await db.from("fan_live_games")
        .upsert(rows, { onConflict: "provider_source,provider_game_id" });
      if (upsertError) throw upsertError;
    }

    // Never synthesize a FINAL from elapsed time or absence in a date-scoped feed.
    // Only an explicit provider FT/AOT/AP/AWD response may finalize a fixture.
    // An omitted/late fixture retains its last provider status, and the UI marks
    // an overdue status as UPDATE DELAYED instead of asserting a false result.
    // NOTE: Prior wrongly finalized rows are displayed as RESULT PENDING if
    // an in-progress period label remains; they need provider reconciliation.

    // Send one in-app reminder when the pregame chat window opens.
    const { data: pendingReminders, error: reminderReadError } = await db.from("fan_live_game_reminders")
      .select("id,game_id,user_id").is("notified_at", null).limit(1000);
    if (reminderReadError) throw reminderReadError;
    const reminderGameIds = Array.from(new Set((pendingReminders || []).map(reminder => reminder.game_id)));
    if (reminderGameIds.length) {
      const { data: reminderGames, error: reminderGamesError } = await db.from("fan_live_games")
        .select("id,team_id,opponent_name,status,scheduled_at,started_at,ends_at")
        .in("id", reminderGameIds);
      if (reminderGamesError) throw reminderGamesError;
      const byId = new Map((reminderGames || []).map(game => [game.id, game]));
      const now = Date.now();
      for (const reminder of pendingReminders || []) {
        const game = byId.get(reminder.game_id);
        if (!game || !game.scheduled_at || ["cancelled","canceled","postponed","abandoned","final"].includes(String(game.status).toLowerCase())) continue;
        const tipoff = Date.parse(game.scheduled_at);
        const opens = tipoff - GAME_CHAT_OPEN_EARLY_MINUTES * 60 * 1000;
        const closes = game.ends_at ? Date.parse(game.ends_at) + 60 * 60 * 1000 : tipoff + 4 * 60 * 60 * 1000;
        if (!Number.isFinite(tipoff) || now < opens || now >= closes) continue;
        const { data: preferences } = await db.from("user_preferences").select("notifications_enabled")
          .eq("user_id", reminder.user_id).maybeSingle();
        if (preferences?.notifications_enabled !== false) {
          const { error: notificationError } = await db.from("notifications").insert({
            user_id: reminder.user_id, target_type: "game", target_id: game.id,
            notification_type: "game_reminder", title: "Game chat is open",
            body: "Chat is open for " + (game.opponent_name || "your scheduled game") + ". Join the game room now.",
          });
          if (notificationError) throw notificationError;
        }
        const { error: markReminderError } = await db.from("fan_live_game_reminders")
          .update({ notified_at: new Date().toISOString() }).eq("id", reminder.id).is("notified_at", null);
        if (markReminderError) throw markReminderError;
      }
    }

    const unmatchedLiveGames = liveGames
      .filter(game => {
        const homeProviderId = Number(game.teams?.home?.id);
        const awayProviderId = Number((game.teams?.away ?? game.teams?.visitors)?.id);
        return !byProviderId.has(homeProviderId) && !byProviderId.has(awayProviderId);
      })
      .slice(0, 10)
      .map(game => ({
        providerGameId: String(game.id),
        status: game.status?.short || null,
        home: { id: game.teams?.home?.id ?? null, name: game.teams?.home?.name ?? null },
        away: { id: (game.teams?.away ?? game.teams?.visitors)?.id ?? null, name: (game.teams?.away ?? game.teams?.visitors)?.name ?? null }
      }));

    return NextResponse.json({
      ok: true,
      fixtureDate,
      dayOffset,
      providerSnapshotReceivedAt: receivedAt,
      providerGamesForDate: payload.response.length,
      approvedGamesForDate: games.length,
      providerLiveGames: liveGames.length,
      providerScheduledGames: rows.filter(row => row.status === "scheduled").length,
      providerFinishedGames: rows.filter(row => row.status === "final").length,
      matchedGames: rows.length,
      incompleteMatchups,
      missingMatchupMappings,
      unmatchedLiveGames
    }, {
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
