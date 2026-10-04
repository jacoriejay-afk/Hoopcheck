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
  const current = seasons.find((season) => season?.current === true);
  if (current?.season != null) return String(current.season);

  const values = seasons
    .map((season) => season?.season)
    .filter((season) => season != null)
    .map((season) => String(season))
    .sort()
    .reverse();

  return values[0] ?? null;
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

  const normalizedLeagues = leagues.flatMap((item) => {
    const league = item?.league ?? item;
    const country = item?.country?.name ?? item?.country ?? null;
    const season = latestSeason(item?.seasons ?? []);

    if (league?.id == null || !league?.name) return [];

    return [{
      externalId: String(league.id),
      name: String(league.name),
      country: country ? String(country) : null,
      level: league.type ? String(league.type) : null,
      season,
    }];
  });

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

  const leagueBatch = leagues.slice(offset, offset + limit);\n  directory.leagues = normalizedLeagues.slice(offset, offset + limit);

  for (const leagueItem of leagueBatch) {
    const league = leagueItem?.league ?? leagueItem;
    if (league?.id == null) continue;

    const country = leagueItem?.country?.name ?? leagueItem?.country ?? null;
    const season = latestSeason(leagueItem?.seasons ?? []);
    if (!season) continue;

    const teams = await apiSportsGet("/teams", {
      league: String(league.id),
      season,
    });

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

const apiSportsBasketballConnector: DirectoryProviderConnector = {
  key: "api_sports_basketball",
  getDirectory: ({ entityType, options }) => getApiSportsBasketballDirectory({ entityType, options }),
};

const connectors: Record<string, DirectoryProviderConnector> = {
  mock: mockDirectoryConnector,
  api_sports_basketball: apiSportsBasketballConnector,
};

export function getDirectoryConnector(key: string | null | undefined) {
  if (!key) return null;
  return connectors[key] ?? null;
}

export function listConnectorKeys() {
  return Object.keys(connectors);
}
