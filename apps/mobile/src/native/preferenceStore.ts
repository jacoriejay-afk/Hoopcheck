export type Role = "player" | "fan" | "coach" | "agent" | "scout" | "manager";
export type Preferences = { haptics: boolean; appLock: boolean; onboardingDone: boolean; role?: Role };
export const defaultPreferences: Preferences = { haptics: true, appLock: false, onboardingDone: false };
const roles: Role[] = ["player", "fan", "coach", "agent", "scout", "manager"];
export function restorePreferences(value: string | null): Preferences {
  if (value === null) return { ...defaultPreferences };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid preferences");
    const data = parsed as Record<string, unknown>;
    return {
      haptics: typeof data.haptics === "boolean" ? data.haptics : true,
      // A malformed saved security setting is not evidence that lock was disabled.
      appLock: data.appLock === undefined ? false : typeof data.appLock === "boolean" ? data.appLock : true,
      onboardingDone: data.onboardingDone === true,
      ...(typeof data.role === "string" && roles.includes(data.role as Role) ? { role: data.role as Role } : {}),
    };
  } catch { return { ...defaultPreferences, appLock: true }; }
}
export function createPreferenceWriter(initial: Preferences, persist: (value: Preferences) => Promise<void>) {
  let committed = { ...initial };
  let queue: Promise<unknown> = Promise.resolve();
  return {
    update(patch: Partial<Preferences>): Promise<Preferences> {
      const pending = queue.catch(() => {}).then(async () => {
        const next = { ...committed, ...patch };
        await persist(next);
        committed = next;
        return { ...next };
      });
      queue = pending;
      return pending;
    },
  };
}
