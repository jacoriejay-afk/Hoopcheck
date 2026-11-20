import type { SupabaseClient } from "@supabase/supabase-js";
export type SearchKind = "teams" | "women" | "leagues" | "womens-leagues" | "players" | "coaches";
export type SearchRow = { id: string; name?: string | null; display_name?: string | null; username?: string | null; country?: string | null; city?: string | null };
export type SearchGroup = { kind: SearchKind; rows: SearchRow[]; failed: boolean };
export const SEARCH_KINDS: SearchKind[] = ["teams", "women", "leagues", "womens-leagues", "players", "coaches"];
export function cleanDirectorySearch(input: string) {
  return input.trim().slice(0, 100).replace(/^@+/, "").replace(/[^\p{L}\p{N}_ '\-]/gu, " ").replace(/\s+/g, " ").trim();
}
export function searchResultPath(kind: SearchKind, id: string): string | null {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return null;
  if (kind === "women") return `/womens/${id}`;
  if (kind === "womens-leagues") return `/womens/leagues/${id}`;
  if (kind === "coaches") return `/web?path=${encodeURIComponent(`/coaches/${id}`)}`;
  return `/${kind}/${id}`;
}
export async function searchDirectory(client: SupabaseClient, input: string, includePlayers = false): Promise<SearchGroup[]> {
  const clean = cleanDirectorySearch(input);
  if (clean.length < 2) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const requests = SEARCH_KINDS.map(async kind => {
    const table = kind === "women" ? "womens_teams" : kind === "womens-leagues" ? "womens_leagues" : kind === "players" ? "profiles" : kind;
    let query;
    if (kind === "players") {
      if (!includePlayers) return { kind, rows: [], failed: false };
      // Shared server-side visibility, role, location and avatar moderation rules.
      const username = clean.replace(/[^\p{L}\p{N}_]/gu, "").toLowerCase();
      if (username.length < 2) return { kind, rows: [], failed: false };
      const result = await client.rpc("search_public_players_by_username", { p_username: username, p_country: null, p_limit: 6, p_offset: 0 }).abortSignal(controller.signal);
      const rows: SearchRow[] = Array.isArray(result.data) ? result.data.filter((row): row is SearchRow => Boolean(row && typeof row.id === "string")) : [];
      return { kind, rows: result.error ? [] : rows, failed: Boolean(result.error) || !Array.isArray(result.data) };
    } else {
      query = client.from(table).select("id,name,country").eq("active", true);
      if (kind === "teams" || kind === "leagues") query = query.eq("basketball_type", "mens");
      query = query.or(`name.ilike.%${clean}%,country.ilike.%${clean}%`).order("name").order("id").limit(6);
    }
    const result = await query.abortSignal(controller.signal).returns<SearchRow[]>();
    return { kind, rows: result.error ? [] : (result.data ?? []), failed: Boolean(result.error) };
  });
  let settled: PromiseSettledResult<SearchGroup>[];
  try { settled = await Promise.allSettled(requests); } finally { clearTimeout(timer); }
  return settled.map((result, index) => result.status === "fulfilled" ? result.value : { kind: SEARCH_KINDS[index], rows: [], failed: true });
}
