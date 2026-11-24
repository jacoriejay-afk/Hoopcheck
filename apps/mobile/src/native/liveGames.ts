import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_FUTURE_WINDOW_MS, GAME_PAST_WINDOW_MS } from "./gameFreshness";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type LiveGame = {
  id: string; team_id: string; opponent_team_id: string | null; opponent_name: string;
  status: string; home_score: number | null; away_score: number | null;
  started_at: string | null; ends_at: string | null; scheduled_at: string | null;
  league_name: string | null; country: string | null; period_label: string | null;
};
export type GameTeam = { id: string; name: string; logo_url?: string | null; logo_bg?: string | null };
export type ChatMessage = { id: string; body: string; created_at: string; user_id: string };
export type ChatControl = { target_user_id: string; is_blocked: boolean; is_muted: boolean };
export type Prediction = { my_pick: string | null; locked: boolean; total_picks: number; results: { winner_team_id: string; winner_percent: number; correct_picks: number; total_picks: number } | null };
const fields = "id,team_id,opponent_team_id,opponent_name,status,home_score,away_score,started_at,ends_at,scheduled_at,league_name,country,period_label";
function deadline() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}
function validId(value: string) { if (!uuid.test(value)) throw new Error("Invalid game request"); }
export async function readBasketballSide(client: SupabaseClient, userId: string) {
  const timer = deadline();
  try {
    validId(userId);
    const result = await client.from("profiles").select("preferred_basketball_side").eq("id", userId).abortSignal(timer.signal).maybeSingle();
    if (result.error || !result.data) throw new Error("Game preferences could not load.");
    return result.data.preferred_basketball_side === "womens" ? "womens" as const : "mens" as const;
  } finally { timer.clear(); }
}
export async function saveBasketballSide(client: SupabaseClient, userId: string, side: "mens" | "womens") {
  const timer = deadline();
  try {
    validId(userId);
    if (!["mens", "womens"].includes(side)) throw new Error("Invalid basketball side.");
    const result = await client.from("profiles").update({ preferred_basketball_side: side }).eq("id", userId).select("preferred_basketball_side").abortSignal(timer.signal).single();
    if (result.error || result.data?.preferred_basketball_side !== side) throw new Error("Basketball preference could not be saved.");
  } finally { timer.clear(); }
}
function api(origin: string) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid game API origin");
  url.pathname = "/api/game-predictions";
  return url;
}
export async function readLiveGames(client: SupabaseClient, side: "mens" | "womens", predictionOnly: { origin: string; token: string } | null = null, now = new Date(), request: typeof fetch = fetch) {
  const timer = deadline();
  try {
    // Query the useful window in PostgREST BEFORE the 500-row cap. A full
    // week of old finals otherwise crowds out today and upcoming games.
    const since = new Date(now.getTime() - GAME_PAST_WINDOW_MS).toISOString();
    const until = new Date(now.getTime() + GAME_FUTURE_WINDOW_MS).toISOString();
    let games: LiveGame[];
    if (predictionOnly) {
      if (!predictionOnly.token) throw new Error("Sign in again to view games.");
      const url = api(predictionOnly.origin); url.searchParams.set("mode", "games");
      const response = await request(url.toString(), { headers: { Authorization: `Bearer ${predictionOnly.token}` }, cache: "no-store", redirect: "error", signal: timer.signal });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.games) || data.games.length > 500) throw new Error("Games could not load.");
      games = data.games;
    } else {
      const result = await client.from("fan_live_games").select(fields).in("status", ["scheduled", "live", "final", "finished", "cancelled", "postponed", "abandoned"]).gte("scheduled_at", since).lte("scheduled_at", until).order("scheduled_at", { ascending: true, nullsFirst: false }).order("id").limit(500).abortSignal(timer.signal);
      if (result.error) throw new Error("Games could not load.");
      games = (result.data ?? []) as LiveGame[];
    }
    if (games.some(game => !uuid.test(game.id) || !uuid.test(game.team_id) || (game.opponent_team_id && !uuid.test(game.opponent_team_id)))) throw new Error("Invalid game response");
    // Also enforce the same bound on the player prediction API response. Avoid
    // fetching crests for irrelevant, unverified or several-week-old matches.
    const recent = Date.parse(since), future = Date.parse(until);
    const visible = games.filter(game => {
      const tip = Date.parse(game.scheduled_at || "");
      return Number.isFinite(tip) && tip >= recent && tip <= future
        && !(game.status === "scheduled" && tip < now.getTime() - 4 * 3600000);
    });
    const ids = [...new Set(visible.flatMap(game => [game.team_id, game.opponent_team_id].filter((value): value is string => Boolean(value))))];
    const teams: Record<string, GameTeam> = {};
    // Bound every IN filter. A women's fixture can be stored with its side as the away team.
    for (let offset = 0; offset < ids.length; offset += 50) {
      const chunk = ids.slice(offset, offset + 50);
      const requests = [client.from("teams").select("id,name,logo_url,logo_bg").in("id", chunk).eq("basketball_type", side).abortSignal(timer.signal)];
      if (side === "womens") requests.push(client.from("womens_teams").select("id,name,logo_url,logo_bg").in("id", chunk).abortSignal(timer.signal));
      for (const result of await Promise.all(requests)) {
        if (result.error) throw new Error("Game teams could not load.");
        for (const team of result.data ?? []) if (ids.includes(team.id)) teams[team.id] = team;
      }
    }
    return { teams, games: visible.filter(game => teams[game.team_id] || teams[game.opponent_team_id || ""]) };
  } finally { timer.clear(); }
}
export async function readGameRoom(client: SupabaseClient, gameId: string, userId: string) {
  const timer = deadline();
  try {
    validId(gameId); validId(userId);
    const [room, controls] = await Promise.all([
      client.rpc("fan_live_chat_room_open", { p_game_id: gameId }).abortSignal(timer.signal),
      client.from("fan_live_chat_user_controls").select("target_user_id,is_blocked,is_muted").eq("user_id", userId).abortSignal(timer.signal),
    ]);
    if (room.error || controls.error || typeof room.data !== "boolean") throw new Error("Chat access could not be verified.");
    if (!room.data) return { open: false, controls: [] as ChatControl[], messages: [] as ChatMessage[], names: {} as Record<string, string> };
    const result = await client.from("fan_live_chat_messages").select("id,body,created_at,user_id").eq("game_id", gameId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200).abortSignal(timer.signal);
    if (result.error) throw new Error("Chat history could not load.");
    const blocked = new Set((controls.data ?? []).filter(row => row.is_blocked || row.is_muted).map(row => row.target_user_id));
    const messages = ((result.data ?? []) as ChatMessage[]).filter(row => !blocked.has(row.user_id)).reverse();
    const authorIds = [...new Set(messages.map(row => row.user_id))];
    const names: Record<string, string> = {};
    // Names are optional; missing profile visibility never expands access to the message body.
    for (let offset = 0; offset < authorIds.length; offset += 50) {
      const profiles = await client.from("profiles").select("id,display_name").in("id", authorIds.slice(offset, offset + 50)).abortSignal(timer.signal);
      if (!profiles.error) for (const profile of profiles.data ?? []) if (typeof profile.display_name === "string") names[profile.id] = profile.display_name;
    }
    return { open: true, controls: (controls.data ?? []) as ChatControl[], messages, names };
  } finally { timer.clear(); }
}
export async function sendGameMessage(client: SupabaseClient, gameId: string, userId: string, text: string) {
  const timer = deadline();
  try {
    validId(gameId); validId(userId);
    const body = text.trim();
    if (!body || body.length > 500) throw new Error("Write a message of up to 500 characters.");
    const room = await client.rpc("fan_live_chat_room_open", { p_game_id: gameId }).abortSignal(timer.signal);
    if (room.error || room.data !== true) throw new Error("This chat room is closed.");
    const result = await client.from("fan_live_chat_messages").insert({ game_id: gameId, user_id: userId, body }).select("id,body,created_at,user_id").abortSignal(timer.signal).single();
    if (result.error) throw new Error(result.error.message.includes("SLOW_MODE") ? "Wait two seconds between messages. Your draft is retained." : result.error.message.includes("CHAT_CLOSED") ? "This chat room is closed. Your draft is retained." : "Message could not be confirmed. Your draft is retained.");
    return result.data as ChatMessage;
  } finally { timer.clear(); }
}
export async function setGameChatControl(client: SupabaseClient, userId: string, target: string, blocked: boolean, muted: boolean) {
  const timer = deadline();
  try {
    validId(userId); validId(target);
    if (userId === target) throw new Error("Choose another member.");
    const result = await client.from("fan_live_chat_user_controls").upsert({ user_id: userId, target_user_id: target, is_blocked: blocked, is_muted: muted, updated_at: new Date().toISOString() }, { onConflict: "user_id,target_user_id" }).abortSignal(timer.signal);
    if (result.error) throw new Error("Chat controls could not be saved.");
  } finally { timer.clear(); }
}
export async function reportGameMessage(client: SupabaseClient, gameId: string, userId: string, message: ChatMessage, reason: string, details: string) {
  const timer = deadline();
  try {
    for (const value of [gameId, userId, message.id, message.user_id]) validId(value);
    if (userId === message.user_id || !["harassment", "spam", "hate", "threat", "other"].includes(reason) || details.length > 500) throw new Error("Invalid message report.");
    const result = await client.from("fan_live_chat_reports").insert({ game_id: gameId, reporter_id: userId, message_id: message.id, reported_user_id: message.user_id, reason, details: details.trim() || null }).abortSignal(timer.signal);
    if (result.error) throw new Error(result.error.code === "23505" ? "You have already reported this message." : "Report could not be confirmed. Try again.");
  } finally { timer.clear(); }
}
export async function readPrediction(origin: string, token: string, gameId: string, request: typeof fetch = fetch): Promise<Prediction> {
  const timer = deadline();
  try {
    validId(gameId); const url = api(origin); url.searchParams.set("gameId", gameId);
    if (!token) throw new Error("Sign in again to view predictions.");
    const response = await request(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal: timer.signal });
    const data = await response.json();
    const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
    if (!response.ok || typeof data.locked !== "boolean" || !count(data.total_picks) || (data.my_pick !== null && !uuid.test(data.my_pick))) throw new Error("Predictions could not be verified.");
    const result = data.results;
    if (result !== null && (!result || !uuid.test(result.winner_team_id) || !count(result.total_picks) || !count(result.correct_picks) || typeof result.winner_percent !== "number" || result.winner_percent < 0 || result.winner_percent > 100)) throw new Error("Invalid prediction results");
    return { my_pick: data.my_pick, locked: data.locked, total_picks: data.total_picks, results: result ? { winner_team_id: result.winner_team_id, total_picks: result.total_picks, correct_picks: result.correct_picks, winner_percent: result.winner_percent } : null };
  } finally { timer.clear(); }
}
export async function pickGameWinner(origin: string, token: string, gameId: string, teamId: string, request: typeof fetch = fetch) {
  const timer = deadline();
  try {
    validId(gameId); validId(teamId); const url = api(origin);
    if (!token) throw new Error("Sign in again before making a prediction.");
    const response = await request(url.toString(), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, cache: "no-store", redirect: "error", signal: timer.signal, body: JSON.stringify({ gameId, pickedTeamId: teamId }) });
    const data = await response.json();
    if (!response.ok || data.ok !== true || data.picked_team_id !== teamId) throw new Error(response.status === 409 ? "Picks are locked at tip-off." : "Pick could not be confirmed. Try again.");
  } finally { timer.clear(); }
}
