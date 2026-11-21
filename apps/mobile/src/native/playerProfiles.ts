import { getOwnProfile } from "../../../../lib/auth/own-profile.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const canBrowsePlayers = (role: string | undefined) => ["player", "coach", "agent", "scout", "manager", "club_admin"].includes(role ?? "");
export type PlayerViewer = { id: string; accountType: string };
export type PlayerProfile = { id: string; display_name: string | null; avatar_url: string | null; country: string | null; bio: string | null; position: string | null; years_pro: number | null; current_country: string | null; current_team: string | null; player_verified: boolean; player_verified_at?: string | null };
const text = (value: unknown, maximum = 500) => typeof value === "string" ? value.slice(0, maximum) : null;
export function safeAvatar(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null; } catch { return null; }
}
export async function readPlayerProfile(client: SupabaseClient, viewer: PlayerViewer, id: string): Promise<PlayerProfile | null> {
  if (!uuid.test(viewer.id) || !uuid.test(id) || !canBrowsePlayers(viewer.accountType)) throw new Error("Player profiles are unavailable for this account.");
  const controller = new AbortController(); const deadline = setTimeout(() => controller.abort(), 15000);
  try {
  // Website's canonical RPC handles public/players-only visibility and avatar
  // moderation. Never cache this response as public directory data.
  const response = await client.rpc("get_public_player_profile", { p_user_id: id }).abortSignal(controller.signal);
  let profile: Record<string, unknown> | null = !response.error && Array.isArray(response.data) ? response.data.find(row => row.id === id) ?? null : null;
  let ownCountryPublic = false;
  if (!profile && id === viewer.id && viewer.accountType === "player") {
    const own = await getOwnProfile(client, id);
    if (own.error) throw new Error("Your player profile could not be loaded.");
    if (own.data?.id === id && own.data.account_type === "player") {
      profile = { ...own.data, player_position: own.data.position, avatar_url: own.data.avatar_moderation_status === "approved" ? own.data.avatar_url : null };
      ownCountryPublic = own.data.current_country_public === true;
    }
  } else if (response.error) throw new Error("Player profile could not be verified. Try again.");
  if (!profile) return null;
  let countryVisible = id === viewer.id || ownCountryPublic;
  if (!countryVisible) {
    const visibility = await client.rpc("is_player_country_public", { p_user_id: id }).abortSignal(controller.signal);
    countryVisible = !visibility.error && visibility.data === true;
  }
  return { id, display_name: text(profile.display_name, 100), avatar_url: safeAvatar(profile.avatar_url), country: text(profile.country, 120), bio: text(profile.bio), position: text(profile.player_position, 30), years_pro: Number.isSafeInteger(profile.years_pro) && Number(profile.years_pro) >= 0 ? Number(profile.years_pro) : null, current_country: countryVisible ? text(profile.current_country, 120) : null, current_team: text(profile.current_team, 160), player_verified: profile.player_verified === true, player_verified_at: profile.player_verified === true && typeof profile.player_verified_at === "string" && Number.isFinite(Date.parse(profile.player_verified_at)) ? profile.player_verified_at : null };
  } finally { clearTimeout(deadline); }
}
