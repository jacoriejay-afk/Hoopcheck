import type { SupabaseClient } from "@supabase/supabase-js";
import type { Photo } from "./mediaSelection";
import { readWithDeadline } from "./readDeadline";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function saveOwnAvatar(client: SupabaseClient, owner: string, photo: Photo, project: string, publishableKey: string, body: (photo: Photo) => Promise<Blob>, request: typeof fetch = fetch) {
  const url = new URL(project);
  if (!uuid.test(owner) || url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !publishableKey || photo.type !== "image/jpeg" || !Number.isSafeInteger(photo.size) || photo.size < 1 || photo.size > 750000) throw new Error("Profile photo could not be verified. Choose a photo again.");
  const { data, error } = await readWithDeadline(() => client.auth.getSession());
  if (error || data.session?.user.id !== owner) throw new Error("Your account changed. Sign in again before saving.");
  const token = data.session.access_token;
  const verified = await readWithDeadline(() => client.auth.getUser(token));
  if (verified.error || verified.data.user?.id !== owner) throw new Error("Your account could not be verified.");
  // Use a captured JWT for both writes: a mutable client session must never
  // redirect an in-flight avatar/profile update to the next signed-in account.
  const headers = { Authorization: `Bearer ${token}`, apikey: publishableKey };
  const path = `${owner}/avatar-${Date.now()}-${Math.random().toString(36).slice(2, 14)}.jpg`;
  const publicUrl = `${url.origin}/storage/v1/object/public/profile-avatars/${path}`;
  const controller = new AbortController(); const deadline = setTimeout(() => controller.abort(), 30000);
  let profileAttempted = false;
  try {
    const form = new FormData(); form.append("cacheControl", "31536000"); form.append("", await body(photo), "photo.jpg");
    const upload = await request(`${url.origin}/storage/v1/object/profile-avatars/${path}`, { method: "POST", headers: { ...headers, "x-upsert": "false" }, body: form, redirect: "error", cache: "no-store", signal: controller.signal });
    if (!upload.ok) throw new Error("Photo upload failed. Your selected photo is unchanged.");
    profileAttempted = true;
    const response = await request(`${url.origin}/rest/v1/profiles?id=eq.${owner}&select=id,avatar_url,avatar_moderation_status`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ avatar_url: publicUrl }), redirect: "error", cache: "no-store", signal: controller.signal });
    const result = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(result) || result.length !== 1 || result[0]?.id !== owner || result[0].avatar_url !== publicUrl || !["pending", "approved", "rejected"].includes(result[0].avatar_moderation_status)) throw new Error("Profile photo save could not be confirmed. Reload your profile before retrying; your selected photo is kept.");
    return { url: publicUrl, status: result[0].avatar_moderation_status as "pending" | "approved" | "rejected" };
  } catch (error) {
    // After any profile attempt a failed response may conceal a committed write.
    // Never remove a possibly referenced avatar or alter moderation state.
    if (!profileAttempted) {
      const cleanup = new AbortController(); const cleanupDeadline = setTimeout(() => cleanup.abort(), 5000);
      try { await request(`${url.origin}/storage/v1/object/profile-avatars`, { method: "DELETE", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [path] }), redirect: "error", signal: cleanup.signal }); } catch { /* No deletion claim; never delete other paths. */ }
      finally { clearTimeout(cleanupDeadline); }
    }
    throw error;
  } finally { clearTimeout(deadline); }
}
