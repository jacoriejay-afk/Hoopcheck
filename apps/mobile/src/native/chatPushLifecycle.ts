type Permission = { granted: boolean; canAskAgain: boolean };
type Registration = {
  preference(signal: AbortSignal): Promise<boolean>;
  permission(): Promise<Permission>;
  requestPermission(): Promise<Permission>;
  token(): Promise<string>;
  sync(token: string | null, signal: AbortSignal): Promise<void>;
};

export async function reconcileChatPush(registration: Registration, prompt: boolean, signal: AbortSignal) {
  if (signal.aborted) return;
  const enabled = await registration.preference(signal);
  if (signal.aborted) return;
  if (!enabled) {
    await registration.sync(null, signal);
    return;
  }
  let permission = await registration.permission();
  if (signal.aborted) return;
  if (prompt && !permission.granted && permission.canAskAgain) permission = await registration.requestPermission();
  if (signal.aborted) return;
  const token = permission.granted ? await registration.token() : null;
  if (!signal.aborted) await registration.sync(token, signal);
}

export function createChatPushReceipts() {
  const seen = new Set<string>();
  return (id: unknown, data: unknown) => {
    if (typeof id !== "string" || !id || id.length > 256 || !data || typeof data !== "object" ||
      Array.isArray(data) || Object.keys(data).length !== 1 || (data as {path?: unknown}).path !== "/notifications" ||
      seen.has(id)) return false;
    seen.add(id);
    if (seen.size > 64) seen.delete(seen.values().next().value!);
    return true;
  };
}
