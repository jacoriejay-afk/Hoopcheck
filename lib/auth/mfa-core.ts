import type { SupabaseClient, User } from "@supabase/supabase-js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type MfaFactor = { id: string; name: string; type: string; verified: boolean };
export type MfaState = { owner: string; required: boolean; level: "aal1" | "aal2"; factors: MfaFactor[] };
export function assuranceForVerifiedUser(token: string, user: Pick<User, "id" | "factors">, now = Date.now()): MfaState {
  // The caller MUST first verify this exact token with Auth.getUser(token).
  // Decoding a token alone is not authorization.
  let claims: Record<string, unknown>;
  try { claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { throw new Error("Your session could not be verified. Sign in again."); }
  if (!uuid.test(user.id) || claims.sub !== user.id || typeof claims.exp !== "number" || claims.exp * 1000 <= now || (claims.aal !== undefined && claims.aal !== "aal1" && claims.aal !== "aal2")) throw new Error("Your session could not be verified. Sign in again.");
  const factors = (user.factors ?? []).map(factor => ({ id: factor.id, name: factor.friendly_name?.slice(0, 50) || "Authenticator", type: factor.factor_type, verified: factor.status === "verified" }));
  if (factors.some(factor => !uuid.test(factor.id))) throw new Error("Security settings could not be verified.");
  const level = claims.aal === "aal2" ? "aal2" : "aal1";
  return { owner: user.id, required: factors.some(factor => factor.verified) && level !== "aal2", level, factors };
}
async function boundedRead<T>(read: () => PromiseLike<T>) {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([Promise.resolve().then(read), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Security verification did not finish. Please try again.")), 15000); })]); }
  finally { clearTimeout(timer!); }
}
export async function readMfaState(client: SupabaseClient, owner: string): Promise<MfaState> {
  const session = await boundedRead(() => client.auth.getSession());
  if (session.error || session.data.session?.user.id !== owner) throw new Error("Your account changed. Sign in again.");
  const token = session.data.session.access_token;
  const verified = await boundedRead(() => client.auth.getUser(token));
  if (verified.error || verified.data.user?.id !== owner) throw new Error("Your session could not be verified. Sign in again.");
  return assuranceForVerifiedUser(token, verified.data.user);
}
function ownedMfa<K extends "enroll" | "unenroll" | "challengeAndVerify">(client: SupabaseClient, owner: string, name: K, args: Parameters<SupabaseClient["auth"]["mfa"][K]>[0]): ReturnType<SupabaseClient["auth"]["mfa"][K]> {
  const execute = (client.auth as unknown as Record<symbol, unknown>)[Symbol.for("hoopcheck.owned-mfa")];
  if (typeof execute !== "function") throw new Error("Security actions are unavailable. Refresh or sign in again.");
  return execute(owner, name, [args]);
}
export async function verifyTotp(client: SupabaseClient, owner: string, factorId: string, code: string) {
  if (!/^\d{6}$/.test(code) || !uuid.test(factorId)) throw new Error("Enter a six-digit authenticator code.");
  const before = await readMfaState(client, owner);
  if (!before.factors.some(factor => factor.id === factorId && factor.type === "totp")) throw new Error("Choose an authenticator registered to this account.");
  const result = await ownedMfa(client, owner, "challengeAndVerify", { factorId, code });
  if (result.error || result.data?.user.id !== owner) throw new Error("The code was not accepted. Use a fresh code and try again.");
  const after = await readMfaState(client, owner);
  if (after.required || after.level !== "aal2") throw new Error("Authenticator verification could not be confirmed. Try again.");
  return after;
}
export async function enrollTotp(client: SupabaseClient, owner: string, name: string) {
  const before = await readMfaState(client, owner);
  if (before.required) throw new Error("Verify your existing authenticator before adding another.");
  const result = await ownedMfa(client, owner, "enroll", { factorType: "totp", friendlyName: name.trim().slice(0, 50) || "HoopCheck authenticator", issuer: "HoopCheck" });
  if (result.error || !result.data || result.data.type !== "totp" || !uuid.test(result.data.id) || !/^[A-Z2-7]{16,128}$/i.test(result.data.totp.secret) || !result.data.totp.qr_code.startsWith("data:image/svg+xml")) throw new Error("Authenticator setup could not be started. Refresh and try again.");
  return { id: result.data.id, qr: result.data.totp.qr_code, secret: result.data.totp.secret };
}
export async function cancelTotpEnrollment(client: SupabaseClient, owner: string, factorId: string) {
  const before = await readMfaState(client, owner);
  if (!before.factors.some(factor => factor.id === factorId && !factor.verified)) throw new Error("Only incomplete setup can be cancelled here.");
  const result = await ownedMfa(client, owner, "unenroll", { factorId });
  if (result.error) throw new Error("Setup cancellation could not be confirmed. Refresh and try again.");
}
export async function removeTotp(client: SupabaseClient, owner: string, factorId: string, verifyWith: string, code: string, confirmDisable: boolean) {
  const before = await readMfaState(client, owner);
  if (!before.factors.some(factor => factor.id === factorId && factor.verified && factor.type === "totp") || !before.factors.some(factor => factor.id === verifyWith && factor.verified && factor.type === "totp")) throw new Error("Choose a registered authenticator for removal and verification.");
  if (before.factors.filter(factor => factor.verified && factor.type === "totp").length === 1 && before.factors.some(factor => factor.verified && factor.type !== "totp")) throw new Error("Keep a supported backup authenticator before removing your last authenticator here.");
  if (before.factors.filter(factor => factor.verified).length === 1 && !confirmDisable) throw new Error("Confirm that you want to disable two-factor protection before removing your last authenticator.");
  await verifyTotp(client, owner, verifyWith, code);
  const result = await ownedMfa(client, owner, "unenroll", { factorId });
  if (result.error) throw new Error("Authenticator removal could not be confirmed. Refresh before trying again.");
  const refreshed = await client.auth.refreshSession();
  if (refreshed.error || refreshed.data.user?.id !== owner) throw new Error("Sign in again to refresh your security settings.");
  return readMfaState(client, owner);
}
