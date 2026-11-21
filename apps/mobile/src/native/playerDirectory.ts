import type { SupabaseClient } from "@supabase/supabase-js";
export type PlayerCard = { id: string; display_name: string | null; username: string | null; country: string | null; current_country: string | null; current_team: string | null; position: string | null; years_pro: number | null; free_agent: boolean; avatar_url: string | null; player_verified: boolean };
export async function readPlayerDirectory(client: SupabaseClient, input: string, start = 0, pageSize = 30): Promise<{ data: PlayerCard[] | null; error: unknown }> {
  const clean = input.trim().replace(/^@+/, "").replace(/[^\p{L}\p{N}_]/gu, "").toLowerCase();
  if (clean.length < 2 || clean.length > 100 || !Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) return { data: [], error: null };
  const controller = new AbortController(); const deadline = setTimeout(() => controller.abort(), 15000);
  try {
    const result = await client.rpc("search_public_players", { p_username: clean, p_country: null, p_limit: pageSize + 1, p_offset: start }).abortSignal(controller.signal);
    if (result.error) return { data: null, error: result.error };
    if (!Array.isArray(result.data) || result.data.some(row => !row || typeof row.id !== "string" || !/^[0-9a-f-]{36}$/i.test(row.id))) return { data: null, error: new Error("Player directory returned an invalid response.") };
    const text = (value: unknown, length = 160) => typeof value === "string" ? value.slice(0, length) : null;
    return { data: result.data.slice(0, pageSize + 1).map(row => ({ id: row.id, display_name: text(row.display_name, 100), username: text(row.username, 100), country: text(row.country, 120), current_country: text(row.current_country, 120), current_team: text(row.current_team), position: text(row.position, 30), years_pro: Number.isSafeInteger(row.years_pro) && row.years_pro >= 0 ? row.years_pro : null, free_agent: row.free_agent === true, avatar_url: text(row.avatar_url, 2048), player_verified: row.player_verified === true })), error: null };
  } finally { clearTimeout(deadline); }
}
