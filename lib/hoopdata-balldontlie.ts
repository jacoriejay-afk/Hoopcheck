import { providerTipoff, validatedProviderScore } from "./hoopdata-ingestion";

export type BdlLeague = "nba" | "wnba";
export type BdlFixture = {
  provider: "balldontlie-nba" | "balldontlie-wnba";
  id: string; season: number; postseason: boolean | null;
  homeProviderId: string; awayProviderId: string; tipoff: string | null;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled" | "abandoned" | "delayed" | "unknown";
  homeScore: number | null; awayScore: number | null;
};
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const positiveId = (value: unknown): string | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : null;

export function normalizeBdlGame(league: BdlLeague, value: unknown): BdlFixture | null {
  const game = object(value);
  if (!game) return null;
  const id = positiveId(game.id), home = positiveId(object(game.home_team)?.id), away = positiveId(object(game.visitor_team)?.id);
  const season = game.season;
  if (!id || !home || !away || home === away || typeof season !== "number" || !Number.isSafeInteger(season) || season < 1900 || season > 2200) return null;
  const state = typeof game.status_state === "string" ? game.status_state : null;
  const raw = typeof game.status === "string" ? game.status.trim() : "";
  let status: BdlFixture["status"] = "unknown";
  if (game.postponed === true) status = "postponed";
  else if (state) {
    const states: Record<string, BdlFixture["status"]> = { scheduled:"scheduled", in_progress:"live", final:"final", postponed:"postponed", canceled:"cancelled", delayed:"delayed", suspended:"delayed", abandoned:"abandoned" };
    if (Object.hasOwn(states,state)) status = states[state];
  } else if (league === "nba") {
    if (raw === "Final") status = "final";
    else if (/^(?:[1-4](?:st|nd|rd|th) Qtr|Halftime|OT(?:[1-9][0-9]*)?|[1-9][0-9]*OT)$/i.test(raw)) status = "live";
    else if (/^[0-9]{1,2}:[0-9]{2}\s*[ap]m\s+[A-Z]{2,4}$/i.test(raw)) status = "scheduled";
  }
  const tipoff = providerTipoff(null, league === "nba" ? game.datetime : game.date);
  const hasScore = status === "live" || status === "final";
  const homeScore = hasScore ? validatedProviderScore(league === "nba" ? game.home_team_score : game.home_score) : null;
  const awayScore = hasScore ? validatedProviderScore(league === "nba" ? game.visitor_team_score : game.away_score) : null;
  if (status === "final" && (homeScore === null || awayScore === null || homeScore === awayScore)) status = "unknown";
  return { provider: league === "nba" ? "balldontlie-nba" : "balldontlie-wnba", id, season,
    postseason: typeof game.postseason === "boolean" ? game.postseason : null, homeProviderId: home, awayProviderId: away, tipoff, status,
    homeScore: status === "unknown" ? null : homeScore, awayScore: status === "unknown" ? null : awayScore };
}

/** One bounded page per request; callers must reserve budget before fetching. */
export function bdlSeasonPageUrl(league: BdlLeague, season: number, cursor?: number): URL {
  if (!Number.isSafeInteger(season) || season < 1900 || season > 2200) throw new Error("Invalid season");
  if (cursor !== undefined && (!Number.isSafeInteger(cursor) || cursor < 1)) throw new Error("Invalid cursor");
  const url = new URL(league === "nba" ? "https://api.balldontlie.io/v1/games" : "https://api.balldontlie.io/wnba/v1/games");
  url.searchParams.append("seasons[]",String(season));
  url.searchParams.set("per_page","100");
  if (cursor !== undefined) url.searchParams.set("cursor",String(cursor));
  return url;
}

export function parseBdlSeasonPage(league: BdlLeague, season: number, payload: unknown, priorCursor?: number): { fixtures: BdlFixture[]; nextCursor: number | null } | null {
  const body = object(payload), meta = object(body?.meta);
  if (!body || !Array.isArray(body.data) || body.data.length > 100 || !meta) return null;
  const fixtures: BdlFixture[] = [], seen = new Set<string>();
  for (const item of body.data) {
    const fixture = normalizeBdlGame(league,item);
    if (!fixture || fixture.season !== season || seen.has(fixture.id)) return null;
    seen.add(fixture.id); fixtures.push(fixture);
  }
  const cursor = meta.next_cursor;
  if (cursor !== null && cursor !== undefined && (typeof cursor !== "number" || !Number.isSafeInteger(cursor) || cursor <= (priorCursor ?? 0) || fixtures.length === 0)) return null;
  return { fixtures, nextCursor: typeof cursor === "number" ? cursor : null };
}

export type VerifiedAlias = { provider: BdlFixture["provider"]; providerGameId: string; canonicalGameId: string };
/** Fail closed: provider aliases must have been verified out-of-band. Never fuzzy-match or create a second fixture. */
export function resolveExistingCanonicalGame(fixture: BdlFixture, aliases: readonly VerifiedAlias[]): string | null {
  const matches = aliases.filter(a => a.provider === fixture.provider && a.providerGameId === fixture.id);
  return matches.length === 1 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matches[0].canonicalGameId)
    ? matches[0].canonicalGameId : null;
}
