import type { LeagueSeasonStatus } from "./league-season-server";

export async function fetchLeagueSeasons(ids: readonly (string | null | undefined)[]): Promise<Record<string, LeagueSeasonStatus>> {
  const leagueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const requests = [];
  for (let offset = 0; offset < leagueIds.length; offset += 100) {
    const params = new URLSearchParams({ ids: leagueIds.slice(offset, offset + 100).join(",") });
    requests.push(fetch(`/api/leagues/season-status?${params}`, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Season status unavailable");
      const payload: { status: Record<string, LeagueSeasonStatus> } = await response.json();
      return payload.status;
    }));
  }
  return Object.assign({}, ...await Promise.all(requests));
}
