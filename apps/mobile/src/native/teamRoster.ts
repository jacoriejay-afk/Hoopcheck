import type { SupabaseClient } from "@supabase/supabase-js";
import { canBrowsePlayers, readPlayerProfile, type PlayerViewer } from "./playerProfiles.ts";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type RosterSpot = { id: string; title: string; description: string | null; season: string | null; expires_at: string | null };
/** Historical opt-in links, not a claim about a player's current club or free-agent status. */
export async function readTeamRoster(client: SupabaseClient, teamId: string, viewer: PlayerViewer, now = new Date()) {
  if (!uuid.test(teamId) || !uuid.test(viewer.id) || !canBrowsePlayers(viewer.accountType)) throw Error("Roster research is unavailable for this account.");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const [history, opportunities] = await Promise.all([
      client.from("player_career_stops").select("player_id,team_name,seasons").eq("team_id", teamId).eq("is_public", true).order("created_at", { ascending: false }).limit(24).abortSignal(controller.signal),
      client.from("team_roster_spots").select("id,title,description,season,expires_at").eq("team_id", teamId).eq("status", "open").or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`).order("created_at", { ascending: false }).limit(20).abortSignal(controller.signal),
    ]);
    if (history.error || opportunities.error) throw Error("Roster research could not load. Try again.");
    const rows = (history.data || []).filter(row => typeof row.player_id === "string" && uuid.test(row.player_id));
    const ids = [...new Set(rows.map(row => row.player_id as string))].slice(0, 12);
    const players: { id: string; name: string; position: string | null; verified: boolean; seasons: string[] }[] = [];
    let partial = false;
    for (let start = 0; start < ids.length; start += 4) {
      const batch = await Promise.allSettled(ids.slice(start, start + 4).map(id => readPlayerProfile(client, viewer, id)));
      for (const result of batch) {
        if (result.status === "rejected") { partial = true; continue; }
        const profile = result.value;
        if (profile) players.push({ id: profile.id, name: profile.display_name || "HoopCheck player", position: profile.position, verified: profile.player_verified, seasons: [...new Set(rows.filter(row => row.player_id === profile.id).map(row => typeof row.seasons === "string" ? row.seasons.slice(0, 80) : "").filter(Boolean))] });
      }
    }
    const spots: RosterSpot[] = (opportunities.data || []).filter(row => uuid.test(row.id) && typeof row.title === "string" && (!row.expires_at || Number.isFinite(Date.parse(row.expires_at)) && Date.parse(row.expires_at) > now.getTime())).map(row => ({ id: row.id, title: row.title.slice(0, 160), description: typeof row.description === "string" ? row.description.slice(0, 2000) : null, season: typeof row.season === "string" ? row.season.slice(0, 80) : null, expires_at: row.expires_at || null }));
    return { players, spots, partial, limited: rows.length === 24 || ids.length === 12 || spots.length === 20 };
  } finally { clearTimeout(timer); }
}
