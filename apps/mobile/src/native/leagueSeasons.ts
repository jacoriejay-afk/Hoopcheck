import type { SupabaseClient } from "@supabase/supabase-js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type LeagueClub = { id: string; name: string; country: string | null; archived?: true };
const PAGE_SIZE = 100;
const MAX_PAGES = 100; // explicit safety ceiling; never report a capped result as complete.
type PageResult<T> = { data: T[] | null; error: unknown };
async function readPages<T>(query: (from: number, to: number) => PromiseLike<PageResult<T>>, signal: AbortSignal) {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    if (signal.aborted) throw Error("League clubs could not load. Try again.");
    const { data, error } = await query(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error || !data || data.length > PAGE_SIZE || signal.aborted) throw Error("League clubs could not load. Try again.");
    rows.push(...data);
    if (data.length < PAGE_SIZE) return { rows, limited: false };
  }
  return { rows, limited: true };
}
/** Explicit historical labels are opaque stored text. For current mode use the
 * league's recorded season when available, retaining legacy primary links.
 * Missing season metadata is not evidence that a club stopped participating.
 */
export async function readLeagueClubs(client: SupabaseClient, leagueId: string, options: { season?: string; signal?: AbortSignal } = {}) {
  if (!uuid.test(leagueId) || options.season !== undefined && (typeof options.season !== "string" || options.season.trim().length > 80)) throw Error("Check the league and season.");
  const season = options.season?.trim() || null;
  const controller = new AbortController(); const cancel = () => controller.abort();
  if (options.signal?.aborted) throw Error("League request cancelled.");
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 15000);
  try {
    let currentSeason: string | null = null;
    if (!season) {
      const league = await client.from("leagues").select("season").eq("id", leagueId).abortSignal(controller.signal).maybeSingle();
      if (league.error || !league.data || controller.signal.aborted) throw Error("League clubs could not load. Try again.");
      currentSeason = typeof league.data.season === "string" && league.data.season.trim() ? league.data.season : null;
    }
    const [direct, linked] = await Promise.all([
      season ? Promise.resolve({ rows: [] as LeagueClub[], limited: false }) :
        readPages<LeagueClub>((from, to) => client.from("teams").select("id,name,country").eq("league_id", leagueId).eq("active", true).order("id").range(from, to).abortSignal(controller.signal), controller.signal),
      readPages<{team_id: string}>((from, to) => {
        let membership = client.from("team_league_memberships").select("team_id").eq("league_id", leagueId);
        if (season) membership = membership.eq("season", season);
        else {
          membership = membership.eq("active", true);
          if (currentSeason) membership = membership.eq("season", currentSeason);
        }
        return membership.order("id").range(from, to).abortSignal(controller.signal);
      }, controller.signal),
    ]);
    const ids = [...new Set(linked.rows.map(row => row.team_id).filter(id => typeof id === "string" && uuid.test(id)))];
    const details: (LeagueClub & { active?: boolean })[] = [];
    let limited = direct.limited || linked.limited;
    for (let i = 0; i < ids.length; i += PAGE_SIZE) {
      const batch = ids.slice(i, i + PAGE_SIZE);
      const result = await readPages<LeagueClub & { active?: boolean }>((from, to) => {
        const query = client.from("teams").select("id,name,country,active").in("id", batch);
        return (season ? query : query.eq("active", true)).order("id").range(from, to).abortSignal(controller.signal);
      }, controller.signal);
      details.push(...result.rows); limited ||= result.limited;
    }
    if (controller.signal.aborted) throw Error("League clubs could not load. Try again.");
    const byId = new Map<string, LeagueClub>();
    for (const row of [...direct.rows, ...details] as (LeagueClub & { active?: boolean })[]) {
      if (!uuid.test(row.id) || typeof row.name !== "string") continue;
      byId.set(row.id, {
        id: row.id, name: row.name.slice(0, 200),
        country: typeof row.country === "string" ? row.country.slice(0, 120) : null,
        ...(season && row.active === false ? { archived: true } : {}),
      });
    }
    const clubs = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return { clubs, season, limited };
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", cancel); }
}

/** Page through visible recorded seasons in stable order. Exact stored labels,
 * not inferred seasons; a safety-capped result is explicitly incomplete.
 */
export async function readRecordedLeagueSeasons(client: SupabaseClient, leagueId: string, signal?: AbortSignal) {
  if (!uuid.test(leagueId) || signal?.aborted) throw Error("Check the league or retry.");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 15000);
  try {
    try {
      const result = await readPages<{season: string | null}>((from, to) => client.from("team_league_memberships")
        .select("season").eq("league_id", leagueId).not("season", "is", null)
        .order("season", { ascending: false }).order("id").range(from, to).abortSignal(controller.signal), controller.signal);
      const seasons = [...new Set(result.rows.map(row => row.season)
        .filter((value): value is string => typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= 80))];
      return { seasons, limited: result.limited };
    } catch { throw Error("Season records could not load."); }
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
}
