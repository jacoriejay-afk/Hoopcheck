// Structural contracts keep this shared policy independent of either app's
// package installation and React/runtime dependency tree.
export type VerifiedMfaUser = { id: string; factors?: { id: string; friendly_name?: string; factor_type: string; status: string }[] };
type MfaClient = { auth: {
  getSession: () => Promise<{ data: { session: { user: VerifiedMfaUser; access_token: string } | null }; error?: unknown }>;
  getUser: (token: string) => Promise<{ data: { user: VerifiedMfaUser | null }; error?: unknown }>;
  refreshSession: () => Promise<{ data: { user: VerifiedMfaUser | null }; error?: unknown }>;
} };
type MfaActions = {
  enroll: { args: { factorType: "totp"; friendlyName: string; issuer: string }; response: { data: { id: string; type: string; totp?: { secret: string; qr_code: string } } | null; error?: unknown } };
  unenroll: { args: { factorId: string }; response: { error?: unknown } };
  challengeAndVerify: { args: { factorId: string; code: string }; response: { data: { user: { id: string } } | null; error?: unknown } };
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type MfaFactor = { id: string; name: string; type: string; verified: boolean };
export type MfaState = { owner: string; required: boolean; level: "aal1" | "aal2"; expiresAt: number; factors: MfaFactor[] };
export function assuranceForVerifiedUser(token: string, user: VerifiedMfaUser, now = Date.now()): MfaState {
  // The caller MUST first verify this exact token with Auth.getUser(token).
  // Decoding a token alone is not authorization.
  let claims: Record<string, unknown>;
  try { claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { throw new Error("Your session could not be verified. Sign in again."); }
  if (!uuid.test(user.id) || claims.sub !== user.id || typeof claims.exp !== "number" || claims.exp * 1000 <= now || (claims.aal !== undefined && claims.aal !== "aal1" && claims.aal !== "aal2")) throw new Error("Your session could not be verified. Sign in again.");
  const factors = (user.factors ?? []).map(factor => ({ id: factor.id, name: factor.friendly_name?.slice(0, 50) || "Authenticator", type: factor.factor_type, verified: factor.status === "verified" }));
  if (factors.some(factor => !uuid.test(factor.id))) throw new Error("Security settings could not be verified.");
  const level = claims.aal === "aal2" ? "aal2" : "aal1";
  return { owner: user.id, required: factors.some(factor => factor.verified) && level !== "aal2", level, expiresAt: claims.exp * 1000, factors };
}
async function boundedRead<T>(read: () => PromiseLike<T>) {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([Promise.resolve().then(read), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Security verification did not finish. Please try again.")), 15000); })]); }
  finally { clearTimeout(timer!); }
}
export async function readMfaState(client: MfaClient, owner: string): Promise<MfaState> {
  const session = await boundedRead(() => client.auth.getSession());
  if (session.error || session.data.session?.user.id !== owner) throw new Error("Your account changed. Sign in again.");
  const token = session.data.session.access_token;
  const verified = await boundedRead(() => client.auth.getUser(token));
  if (verified.error || verified.data.user?.id !== owner) throw new Error("Your session could not be verified. Sign in again.");
  return assuranceForVerifiedUser(token, verified.data.user);
}
function ownedMfa<K extends keyof MfaActions>(client: MfaClient, owner: string, name: K, args: MfaActions[K]["args"]): Promise<MfaActions[K]["response"]> {
  const execute = (client.auth as unknown as Record<symbol, unknown>)[Symbol.for("hoopcheck.owned-mfa")];
  if (typeof execute !== "function") throw new Error("Security actions are unavailable. Refresh or sign in again.");
  return execute(owner, name, [args]);
}
export async function verifyTotp(client: MfaClient, owner: string, factorId: string, code: string) {
  if (!/^\d{6}$/.test(code) || !uuid.test(factorId)) throw new Error("Enter a six-digit authenticator code.");
  const before = await readMfaState(client, owner);
  if (!before.factors.some(factor => factor.id === factorId && factor.type === "totp")) throw new Error("Choose an authenticator registered to this account.");
  const result = await ownedMfa(client, owner, "challengeAndVerify", { factorId, code });
  if (result.error || result.data?.user.id !== owner) throw new Error("The code was not accepted. Use a fresh code and try again.");
  const after = await readMfaState(client, owner);
  if (after.required || after.level !== "aal2") throw new Error("Authenticator verification could not be confirmed. Try again.");
  return after;
}
export async function enrollTotp(client: MfaClient, owner: string, name: string) {
  const before = await readMfaState(client, owner);
  if (before.required) throw new Error("Verify your existing authenticator before adding another.");
  const result = await ownedMfa(client, owner, "enroll", { factorType: "totp", friendlyName: name.trim().slice(0, 50) || "HoopCheck authenticator", issuer: "HoopCheck" });
  if (result.error || !result.data || result.data.type !== "totp" || !result.data.totp || !uuid.test(result.data.id) || !/^[A-Z2-7]{16,128}$/i.test(result.data.totp.secret) || !result.data.totp.qr_code.startsWith("data:image/svg+xml")) throw new Error("Authenticator setup could not be started. Refresh and try again.");
  return { id: result.data.id, qr: result.data.totp.qr_code, secret: result.data.totp.secret };
}
export async function cancelTotpEnrollment(client: MfaClient, owner: string, factorId: string) {
  const before = await readMfaState(client, owner);
  if (!before.factors.some(factor => factor.id === factorId && !factor.verified)) throw new Error("Only incomplete setup can be cancelled here.");
  const result = await ownedMfa(client, owner, "unenroll", { factorId });
  if (result.error) throw new Error("Setup cancellation could not be confirmed. Refresh and try again.");
}
export async function removeTotp(client: MfaClient, owner: string, factorId: string, verifyWith: string, code: string, confirmDisable: boolean) {
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
