import type { DirectoryProviderConnector, DirectorySyncOptions, NormalizedDirectory, SyncEntityType } from "./types";
import { mockDirectoryConnector } from "./mock-connector";

const API_SPORTS_BASE = "https://v1.basketball.api-sports.io";
const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 50;

type ApiResponse = {
  response?: any[];
  errors?: Record<string, unknown> | unknown[];
};

async function apiSportsGet(path: string, params: Record<string, string> = {}) {
  const key = process.env.API_SPORTS_BASKETBALL_KEY;
  if (!key) throw new Error("API_SPORTS_BASKETBALL_KEY is not configured");

  const url = new URL(API_SPORTS_BASE + path);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));

  const response = await fetch(url, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API-Basketball request failed (${response.status})`);
  }

  const payload = (await response.json()) as ApiResponse;
  if (payload.errors && Object.keys(payload.errors as object).length > 0) {
    throw new Error(`API-Basketball returned an error: ${JSON.stringify(payload.errors)}`);
  }

  return payload.response ?? [];
}

function latestSeason(seasons: any[]): string | null {
  // API-Sports Free plans currently restrict basketball season access to 2022-2024.
  // Use an explicit env override when available; otherwise prefer 2024 so the
  // directory sync works on the free plan. Paid plans can set a newer season.
  const configured = process.env.API_SPORTS_BASKETBALL_SEASON?.trim();
  if (configured) return configured;

  const eligible = seasons
    .map((season) => season?.season)
    .filter((season) => season != null)
    .map((season) => String(season))
    .filter((season) => Number(season) <= 2024)
    .sort()
    .reverse();

  if (eligible[0]) return eligible[0];

  const current = seasons.find((season) => season?.current === true);
  if (current?.season != null) return String(current.season);

  return null;
}

function batchOptions(options?: DirectorySyncOptions) {
  const offset = Math.max(0, Math.floor(options?.offset ?? 0));
  const limit = Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(options?.limit ?? DEFAULT_BATCH_SIZE)));
  return { offset, limit };
}

async function getApiSportsBasketballDirectory(
  input: { entityType: SyncEntityType; options?: DirectorySyncOptions }
): Promise<NormalizedDirectory> {
  const directory: NormalizedDirectory = { leagues: [], teams: [], coaches: [] };
  const { offset, limit } = batchOptions(input.options);

  const leagues = await apiSportsGet("/leagues");

  const normalizedLeagues = Array.from(new Map(leagues.flatMap((item) => {
    const league = item?.league ?? item;
    const country = item?.country?.name ?? item?.country ?? null;
    const season = process.env.API_SPORTS_BASKETBALL_SEASON?.trim() || "2024";

    if (league?.id == null || !league?.name) return [];

    return [{
      externalId: String(league.id),
      name: String(league.name),
      country: country ? String(country) : null,
      level: league.type ? String(league.type) : null,
      season,
    }];
  })).map((row) => [row.externalId, row])).values());

  if (input.entityType === "leagues") {
    directory.leagues = normalizedLeagues.slice(offset, offset + limit);
    return directory;
  }

  if (input.entityType === "coaches") {
    /*
     * API-Basketball currently exposes leagues, teams and player/game data,
     * but not a dedicated basketball-coaches endpoint. We deliberately leave
     * coaches empty instead of inventing or scraping unlicensed coach records.
     */
    return directory;
  }

  const leagueBatch = normalizedLeagues.slice(offset, offset + limit);
  directory.leagues = leagueBatch;

  for (const normalizedLeague of leagueBatch) {
    const leagueItem = leagues.find((item: any) => String((item?.league ?? item)?.id) === normalizedLeague.externalId);

    const league = leagueItem?.league ?? leagueItem;
    if (league?.id == null) continue;

    const country = leagueItem?.country?.name ?? leagueItem?.country ?? null;
    let season = process.env.API_SPORTS_BASKETBALL_SEASON?.trim() || "2024";

    // When no season override is configured, discover an eligible season for
    // this specific competition. This avoids returning zero teams for leagues
    // whose 2024 season is unavailable on the free plan.
    if (!process.env.API_SPORTS_BASKETBALL_SEASON?.trim()) {
      try {
        const seasonRows = await apiSportsGet("/leagues", { id: String(league.id) });
        const discovered = latestSeason(
          seasonRows.flatMap((row: any) => row?.seasons ?? [])
        );
        if (discovered) season = discovered;
      } catch (error) {
        console.warn(
          `Unable to discover season for API-Basketball league ${league.id}: `,
          error instanceof Error ? error.message : error
        );
      }
    }

    if (!season) continue;

    let teams: any[] = [];
    try {
      teams = await apiSportsGet("/teams", {
        league: String(league.id),
        season,
      });
    } catch (error) {
      // API-Sports Free plans do not expose every competition/season.
      // Keep the batch alive so one unavailable league does not block
      // otherwise valid team records from the remaining leagues.
      console.warn(
        `Skipping API-Basketball league ${league.id} (${league.name}) for season ${season}: `,
        error instanceof Error ? error.message : error
      );
      continue;
    }

    for (const item of teams) {
      const team = item?.team ?? item;
      if (team?.id == null || !team?.name) continue;

      const city = item?.venue?.city ?? team?.city ?? null;

      directory.teams.push({
        externalId: String(team.id),
        name: String(team.name),
        country: team.country ? String(team.country) : country ? String(country) : null,
        city: city ? String(city) : null,
        leagueExternalId: String(league.id),
        leagueName: String(league.name),
        season,
      });
    }
  }

  return directory;
}

async function sportsDbGet(path: string, params: Record<string, string> = {}) {
  const key = process.env.THESPORTSDB_API_KEY?.trim() || "123";
  const url = new URL(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(key)}${path}`);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`TheSportsDB request failed (${response.status})`);
  const payload = await response.json();
  if (payload?.message && !payload?.teams && !payload?.leagues) {
    throw new Error(`TheSportsDB returned an error: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function getTheSportsDbDirectory(
  input: { entityType: SyncEntityType; options?: DirectorySyncOptions }
): Promise<NormalizedDirectory> {
  const directory: NormalizedDirectory = { leagues: [], teams: [], coaches: [] };
  const { offset, limit } = batchOptions(input.options);
  const payload = await sportsDbGet("/all_leagues.php");
  const leagues = (payload?.leagues ?? []).filter((l: any) => String(l?.strSport ?? "").toLowerCase() === "basketball");
  const leagueBatch = leagues.slice(offset, offset + limit);

  directory.leagues = leagueBatch.flatMap((l: any) => l?.idLeague && l?.strLeague ? [{
    externalId: String(l.idLeague),
    name: String(l.strLeague),
    country: l.strCountry ? String(l.strCountry) : null,
    level: null,
    season: null,
  }] : []);

  if (input.entityType === "leagues") return directory;

  for (const league of directory.leagues) {
    const teamsPayload = await sportsDbGet("/search_all_teams.php", { l: league.name });
    for (const item of teamsPayload?.teams ?? []) {
      if (!item?.idTeam || !item?.strTeam) continue;
      const country = item.strCountry || league.country || null;
      directory.teams.push({
        externalId: String(item.idTeam),
        name: String(item.strTeam),
        country: country ? String(country) : null,
        city: item.strCity ? String(item.strCity) : null,
        leagueExternalId: league.externalId ?? null,
        leagueName: league.name,
        season: null,
      });
      if (input.entityType === "coaches" && item.strManager) {
        directory.coaches.push({
          externalId: `tsdb-team-${item.idTeam}-manager`,
          name: String(item.strManager),
          country: country ? String(country) : null,
          city: item.strCity ? String(item.strCity) : null,
          role: "Head Coach",
          teamExternalId: String(item.idTeam),
          teamName: String(item.strTeam),
          season: null,
        });
      }
    }
  }

  if (input.entityType === "coaches") directory.teams = [];
  return directory;
}

const theSportsDbConnector: DirectoryProviderConnector = {
  key: "thesportsdb",
  getDirectory: ({ entityType, options }) => getTheSportsDbDirectory({ entityType, options }),
};

const apiSportsBasketballConnector: DirectoryProviderConnector = {
  key: "api_sports_basketball",
  getDirectory: ({ entityType, options }) => getApiSportsBasketballDirectory({ entityType, options }),
};

const connectors: Record<string, DirectoryProviderConnector> = {
  mock: mockDirectoryConnector,
  api_sports_basketball: apiSportsBasketballConnector,
  thesportsdb: theSportsDbConnector,
};

export function getDirectoryConnector(key: string | null | undefined) {
  if (!key) return null;
  return connectors[key] ?? null;
}

export function listConnectorKeys() {
  return Object.keys(connectors);
}
