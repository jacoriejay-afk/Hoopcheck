import type { SupabaseClient } from "@supabase/supabase-js";
export const TEAM_PAGE_SIZE = 40;
export function cleanTeamSearch(search: string) {
  return search.trim().slice(0, 120).replace(/[^\p{L}\p{N} '\-]/gu, " ").replace(/\s+/g, " ").trim();
}
export function teamDirectoryQuery(client: SupabaseClient, women: boolean, search: string, start: number) {
  let query = client.from(women ? "womens_teams" : "teams").select("id,name,country,city,league_name,logo_url,logo_bg").eq("active", true);
  if (!women) query = query.eq("basketball_type", "mens");
  query = query.order("name", { ascending: true }).order("id", { ascending: true }).range(start, start + TEAM_PAGE_SIZE);
  const clean = cleanTeamSearch(search);
  if (clean) query = query.or(`name.ilike.%${clean}%,country.ilike.%${clean}%,city.ilike.%${clean}%,league_name.ilike.%${clean}%`);
  return query;
}
