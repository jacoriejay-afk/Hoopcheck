import type { SupabaseClient } from "@supabase/supabase-js";
export const TEAM_PAGE_SIZE = 40;
export function cleanTeamSearch(search: string) {
  return search.trim().slice(0, 120).replace(/[^\p{L}\p{N} '\-]/gu, " ").replace(/\s+/g, " ").trim();
}
export type TeamFacet = { country: string; league: string };
export const EMPTY_TEAM_FACET: TeamFacet = { country: "", league: "" };
export const teamDirectoryScope = (women: boolean, search: string, facet: TeamFacet = EMPTY_TEAM_FACET) => JSON.stringify([women, cleanTeamSearch(search), facet.country, facet.league]);
export function teamDirectoryQuery(client: SupabaseClient, women: boolean, search: string, start: number, facet: TeamFacet = EMPTY_TEAM_FACET) {
  let query = client.from(women ? "womens_teams" : "teams").select("id,name,country,city,league_name,logo_url,logo_bg").eq("active", true);
  if (!women) query = query.eq("basketball_type", "mens");
  if (facet.country) query = query.eq("country", facet.country);
  if (facet.country && facet.league) query = query.eq("league_name", facet.league);
  query = query.order("name", { ascending: true }).order("id", { ascending: true }).range(start, start + TEAM_PAGE_SIZE);
  const clean = cleanTeamSearch(search);
  if (clean) query = query.or(`name.ilike.%${clean}%,country.ilike.%${clean}%,city.ilike.%${clean}%,league_name.ilike.%${clean}%`);
  return query;
}

/** Retain one row per canonical ID while preserving first-seen order. */
export function mergeTeamDirectoryRows<T extends { id: string }>(current: T[], page: T[]): T[] {
  return [...new Map([...current, ...page].map(row => [row.id, row])).values()];
}

/** Load only directory labels on demand. Bounded scan: not a season census. */
export async function readTeamFacets(client: SupabaseClient, women: boolean, signal: AbortSignal) {
  const size = 500, cap = 5000, options = new Map<string, Set<string>>();
  let complete = false;
  for (let start = 0; start < cap; start += size) {
    if (signal.aborted) throw Error("Directory filter request cancelled");
    let query = client.from(women ? "womens_teams" : "teams").select("id,country,league_name").eq("active", true);
    if (!women) query = query.eq("basketball_type", "mens");
    const result = await query.order("id",{ascending:true}).range(start,start+size-1).abortSignal(signal);
    if (result.error || !Array.isArray(result.data) || result.data.length > size || signal.aborted) throw Error("Directory filters unavailable");
    for (const row of result.data) {
      if (typeof row.country !== "string" || !row.country.trim() || row.country.length > 200) continue;
      const leagues = options.get(row.country) ?? new Set<string>();
      if (typeof row.league_name === "string" && row.league_name.trim() && row.league_name.length <= 250) leagues.add(row.league_name);
      options.set(row.country,leagues);
    }
    if (result.data.length < size) {complete=true;break;}
  }
  const sort = (a:string,b:string)=>a.localeCompare(b);
  return {complete,countries:[...options.entries()].sort(([a],[b])=>sort(a,b)).map(([country,leagues])=>({country,leagues:[...leagues].sort(sort)}))};
}
