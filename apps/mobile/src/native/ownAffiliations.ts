import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerViewer } from "./playerProfiles";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type OwnAffiliation = { id: string; teamId: string; teamName: string; start: string | null; end: string | null };
/** Existing hosted owner/admin RLS; no public roster inference or evidence-document access. */
export async function readOwnAffiliations(client: SupabaseClient, viewer: PlayerViewer, profileId: string, now = new Date(), signal?: AbortSignal) {
  if (!uuid.test(viewer.id) || !uuid.test(profileId) || viewer.id !== profileId || viewer.accountType !== "player") throw Error("Only your own player links are available.");
  if (signal?.aborted) throw Error("Request cancelled.");
  const controller = new AbortController(); const cancel = () => controller.abort(); signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 15000); const today = now.toISOString().slice(0, 10);
  const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
  try {
    const result = await client.from("player_team_affiliations").select("id,user_id,team_id,relationship,start_date,end_date,verified").eq("user_id", viewer.id).eq("relationship", "current").eq("verified", true)
      .or(`and(start_date.lte.${today},end_date.gte.${today}),and(start_date.lte.${today},end_date.is.null),and(start_date.is.null,end_date.gte.${today}),and(start_date.is.null,end_date.is.null)`).order("start_date", { ascending: false, nullsFirst: false }).limit(20).abortSignal(controller.signal);
    if (result.error) throw Error("Your verified team links could not load.");
    const rows = (result.data || []).filter(row => row.user_id === viewer.id && uuid.test(row.id) && uuid.test(row.team_id) && row.relationship === "current" && row.verified === true && (row.start_date == null || validDate(row.start_date) && row.start_date <= today) && (row.end_date == null || validDate(row.end_date) && row.end_date >= today));
    const ids = [...new Set(rows.map(row => row.team_id))];
    const teams = ids.length ? await client.from("teams").select("id,name").in("id", ids).limit(20).abortSignal(controller.signal) : { data: [], error: null };
    if (teams.error || controller.signal.aborted) throw Error("Your verified team links could not load.");
    const names = new Map((teams.data || []).filter(row => typeof row.name === "string").map(row => [row.id, row.name.slice(0, 200)]));
    return { rows: rows.map(row => ({ id: row.id, teamId: row.team_id, teamName: names.get(row.team_id) || "Team name unavailable", start: row.start_date || null, end: row.end_date || null })) as OwnAffiliation[], limited: (result.data?.length || 0) === 20 };
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
}
