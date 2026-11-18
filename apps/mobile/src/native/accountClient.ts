export type NativeAccount = {
  user: { id: string; displayName: string; accountType: string };
  tier: "free" | "pro" | "premium";
  hasPaidMembership: boolean;
  features: { canReadHoopFeed: boolean; canWriteHoopFeed: boolean; canUseLiveGameHub: boolean; canUseFanGroups: boolean };
};
export function parseNativeAccount(input: unknown): NativeAccount {
  if (!input || typeof input !== "object") throw new Error("Invalid account response");
  const data = input as Record<string, unknown>;
  const user = data.user as Record<string, unknown> | null;
  const rights = data.entitlements as Record<string, unknown> | null;
  if (!user || !rights || typeof user.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) || typeof user.accountType !== "string" || !["free", "pro", "premium"].includes(String(rights.tier)) || typeof rights.hasPaidMembership !== "boolean") throw new Error("Invalid account response");
  const features = {} as NativeAccount["features"];
  for (const key of ["canReadHoopFeed", "canWriteHoopFeed", "canUseLiveGameHub", "canUseFanGroups"] as const) {
    if (typeof rights[key] !== "boolean") throw new Error("Invalid account permissions");
    features[key] = rights[key];
  }
  return { user: { id: user.id, displayName: typeof user.displayName === "string" ? user.displayName.slice(0, 200) : "", accountType: user.accountType }, tier: rights.tier as NativeAccount["tier"], hasPaidMembership: rights.hasPaidMembership, features };
}
export async function requestNativeAccount(origin: string, token: string, signal?: AbortSignal, request: typeof fetch = fetch) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !token) throw new Error("Invalid account request");
  url.pathname = "/api/mobile/bootstrap";
  const response = await request(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal });
  if (!response.ok) throw new Error("Account access could not be verified");
  return parseNativeAccount(await response.json());
}
