import type { SupabaseClient } from "@supabase/supabase-js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type LeagueClub = { id: string; name: string; country: string | null };
/** Season labels are opaque stored text; never guess current season or infer playing statistics. */
export async function readLeagueClubs(client: SupabaseClient, leagueId: string, options: { season?: string; signal?: AbortSignal } = {}) {
  if (!uuid.test(leagueId) || options.season !== undefined && (typeof options.season !== "string" || options.season.trim().length > 80)) throw Error("Check the league and season.");
  const season = options.season?.trim() || null;
  const controller = new AbortController(); const cancel = () => controller.abort();
  if (options.signal?.aborted) throw Error("League request cancelled.");
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 15000);
  try {
    let membership = client.from("team_league_memberships").select("team_id").eq("league_id", leagueId);
    membership = season ? membership.eq("season", season) : membership.eq("active", true);
    const [direct, linked] = await Promise.all([
      season ? Promise.resolve({ data: [] as LeagueClub[], error: null }) : client.from("teams").select("id,name,country").eq("league_id", leagueId).eq("active", true).order("name").limit(50).abortSignal(controller.signal),
      membership.order("team_id").limit(100).abortSignal(controller.signal),
    ]);
    if (direct.error || linked.error) throw Error("League clubs could not load. Try again.");
    const ids = [...new Set((linked.data || []).map(row => row.team_id).filter(id => typeof id === "string" && uuid.test(id)))];
    const details = ids.length ? await client.from("teams").select("id,name,country").in("id", ids).eq("active", true).order("name").limit(50).abortSignal(controller.signal) : { data: [], error: null };
    if (details.error || controller.signal.aborted) throw Error("League clubs could not load. Try again.");
    const clubs = [...new Map([...(direct.data || []), ...(details.data || [])].filter(row => uuid.test(row.id) && typeof row.name === "string").map(row => [row.id, { id: row.id, name: row.name.slice(0, 200), country: typeof row.country === "string" ? row.country.slice(0, 120) : null }])).values()].sort((a, b) => a.name.localeCompare(b.name));
    return { clubs, season, limited: (direct.data?.length || 0) === 50 || (linked.data?.length || 0) === 100 || (details.data?.length || 0) === 50 };
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", cancel); }
}
