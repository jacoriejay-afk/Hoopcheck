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
export async function searchDirectory(client: SupabaseClient, input: string): Promise<SearchGroup[]> {
  const clean = cleanDirectorySearch(input);
  if (clean.length < 2) return [];
  const requests = SEARCH_KINDS.map(async kind => {
    const table = kind === "women" ? "womens_teams" : kind === "womens-leagues" ? "womens_leagues" : kind === "players" ? "profiles" : kind;
    let query;
    if (kind === "players") {
      // Same public-player eligibility as the existing native player directory.
      const username = clean.replace(/[^\p{L}\p{N}_]/gu, "").toLowerCase();
      if (username.length < 2) return { kind, rows: [], failed: false };
      query = client.from(table).select("id,display_name,username,country").eq("account_type", "player").eq("profile_visibility", "public").eq("moderation_status", "normal").in("basketball_type", ["mens", "womens"]).eq("professional_experience", true).ilike("username", `%${username}%`).order("username").order("id").limit(6);
    } else {
      query = client.from(table).select("id,name,country").eq("active", true);
      if (kind === "teams" || kind === "leagues") query = query.eq("basketball_type", "mens");
      query = query.or(`name.ilike.%${clean}%,country.ilike.%${clean}%`).order("name").order("id").limit(6);
    }
    const result = await query.returns<SearchRow[]>();
    return { kind, rows: result.error ? [] : (result.data ?? []), failed: Boolean(result.error) };
  });
  const settled = await Promise.allSettled(requests);
  return settled.map((result, index) => result.status === "fulfilled" ? result.value : { kind: SEARCH_KINDS[index], rows: [], failed: true });
}
