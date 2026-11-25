import { getOwnProfile } from "../../../../lib/auth/own-profile.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles = ["player", "coach", "fan", "agent", "scout", "club_admin", "manager"];
export const profileCovers = [
  { id: "court", label: "Court", color: "#ff790b" }, { id: "rose", label: "Rose", color: "#ef77af" },
  { id: "violet", label: "Violet", color: "#9d89f5" }, { id: "ocean", label: "Ocean", color: "#59b8cf" },
  { id: "forest", label: "Forest", color: "#2fa67b" }, { id: "gold", label: "Gold", color: "#e5b84c" },
  { id: "midnight", label: "Midnight", color: "#5266b5" }, { id: "coral", label: "Coral", color: "#ef745c" },
] as const;
export type ProfileCover = typeof profileCovers[number]["id"];
export const profileCover = (value: unknown): ProfileCover => profileCovers.find(item => item.id === value)?.id ?? "court";
export const privateProfileRole = (role: string) => ["fan", "agent", "scout"].includes(role);
export type EditableProfile = {
  display_name: string; bio: string; hometown: string; nationality: string; favorite_teams: string;
  favorite_leagues: string; interests: string; experience_summary: string; position: string;
  height: string; current_country: string; current_team: string; free_agent: boolean;
  current_country_public: boolean; profile_visibility: "public" | "players_only";
};
export type OwnProfile = EditableProfile & { id: string; account_type: string; first_name: string; last_name: string; years_pro: string; username: string };
// Match existing UTF-16 input limits without cutting a Unicode surrogate pair.
const text = (value: unknown, max: number) => {
  if (typeof value !== "string") return "";
  let end = Math.min(value.length, max);
  if (end > 0 && end < value.length) {
    const before = value.charCodeAt(end - 1);
    const after = value.charCodeAt(end);
    if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff) end--;
  }
  return value.slice(0, end);
};
const limits = { display_name: 80, bio: 500, hometown: 120, nationality: 80, favorite_teams: 500, favorite_leagues: 500, interests: 500, experience_summary: 1000, position: 30, height: 24, current_country: 120, current_team: 160 } as const;
export function parseProfileDraft(input: unknown): EditableProfile | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Record<string, unknown>;
  if (Object.keys(limits).some(key => typeof source[key] !== "string") || typeof source.free_agent !== "boolean" || typeof source.current_country_public !== "boolean" || !["public", "players_only"].includes(String(source.profile_visibility))) return null;
  return { ...Object.fromEntries(Object.entries(limits).map(([key, limit]) => [key, text(source[key], limit)])), free_agent: source.free_agent, current_country_public: source.current_country_public, profile_visibility: source.profile_visibility } as EditableProfile;
}
async function deadline<T>(work: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([work(controller.signal), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Request could not be confirmed. Try again.")); }, 15000); })]); } finally { clearTimeout(timer); }
}
export async function readOwnProfile(client: SupabaseClient, userId: string): Promise<OwnProfile> {
  if (!uuid.test(userId)) throw new Error("Invalid profile owner");
  const { data, error } = await getOwnProfile(client, userId, { origin: process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online" });
  if (error || !data || data.id !== userId || !roles.includes(data.account_type)) throw new Error("Your profile could not be verified. Try again.");
  const fields = Object.fromEntries(Object.entries(limits).map(([key, limit]) => [key, text(data[key as keyof typeof limits], limit)]));
  return { ...fields, id: userId, account_type: data.account_type, first_name: text(data.first_name, 100), last_name: text(data.last_name, 100), username: text(data.username, 100), years_pro: Number.isSafeInteger(data.years_pro) && data.years_pro >= 0 ? String(data.years_pro) : "", free_agent: data.free_agent === true, current_country_public: data.current_country_public === true, profile_visibility: data.profile_visibility === "public" ? "public" : "players_only" } as OwnProfile;
}
export async function saveOwnProfile(client: SupabaseClient, userId: string, draft: EditableProfile) {
  const profile = await readOwnProfile(client, userId); // Current server role, never editable input/metadata.
  const valid = parseProfileDraft(draft); if (!valid) throw new Error("Invalid profile values");
  const clean = (key: keyof typeof limits) => text(valid[key].trim(), limits[key]) || null;
  const values = {
    display_name: clean("display_name"), bio: clean("bio"), hometown: clean("hometown"), nationality: clean("nationality"),
    favorite_teams: clean("favorite_teams"), favorite_leagues: clean("favorite_leagues"), interests: clean("interests"),
    ...(profile.account_type === "coach" ? { experience_summary: clean("experience_summary") } : {}),
    ...(profile.account_type === "player" ? { position: clean("position"), height: clean("height"), current_country: clean("current_country"), current_team: valid.free_agent ? null : clean("current_team"), free_agent: valid.free_agent, current_country_public: valid.current_country_public } : {}),
    ...(!privateProfileRole(profile.account_type) ? { profile_visibility: valid.profile_visibility } : {}),
  };
  const session = await deadline(() => client.auth.getSession());
  if (session.error || session.data.session?.user.id !== userId) throw new Error("Your account changed. Verify it before saving.");
  const token = session.data.session.access_token;
  const { data, error } = await deadline(signal => client.from("profiles").update(values).eq("id", userId).select("id").setHeader("Authorization", `Bearer ${token}`).abortSignal(signal).maybeSingle());
  if (error || data?.id !== userId) throw new Error("Profile save could not be confirmed. Your draft is unchanged.");
}
export async function readOwnCover(client: SupabaseClient, userId: string) {
  const { data, error } = await deadline(() => client.auth.getUser());
  if (error || !uuid.test(userId) || data.user?.id !== userId) throw new Error("Profile appearance could not be verified");
  return profileCover(data.user.user_metadata?.hoopcheck_profile_cover);
}
export async function saveOwnCover(client: SupabaseClient, userId: string, cover: ProfileCover, projectOrigin: string, publishableKey: string, request: typeof fetch = fetch) {
  if (!profileCovers.some(item => item.id === cover)) throw new Error("Invalid profile cover");
  const url = new URL(projectOrigin);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !publishableKey) throw new Error("Invalid appearance configuration");
  const { data: session, error: sessionError } = await deadline(() => client.auth.getSession());
  if (sessionError || !uuid.test(userId) || session.session?.user.id !== userId) throw new Error("Your account changed. Verify it before saving.");
  const token = session.session.access_token;
  const verified = await deadline(() => client.auth.getUser(token));
  if (verified.error || verified.data.user?.id !== userId) throw new Error("Your account could not be verified");
  // A fixed token binds the Auth write to the verified owner even if another
  // account signs in while this request is in flight. updateUser() reads mutable
  // session state and cannot express an explicit target user ID.
  url.pathname = "/auth/v1/user";
  const result = await deadline(signal => request(url.toString(), { method: "PUT", headers: { Authorization: `Bearer ${token}`, apikey: publishableKey, "Content-Type": "application/json" }, body: JSON.stringify({ data: { hoopcheck_profile_cover: cover } }), cache: "no-store", redirect: "error", signal }));
  const user = await result.json().catch(() => null);
  if (!result.ok || user?.id !== userId || user.user_metadata?.hoopcheck_profile_cover !== cover) throw new Error("Cover save could not be confirmed. Refresh before trying again.");
}
