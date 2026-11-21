import { parseEffectiveMembership, type EffectiveMembership } from "./membership";
type SessionResult = { data: { session: { user: { id: string }; access_token: string } | null }; error: unknown };
type Result = { data: EffectiveMembership | null; error: Error | null };
export async function readDeadline<T>(work: () => PromiseLike<T>, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([Promise.resolve().then(work), new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Error("Membership could not be verified. Please try again.")), milliseconds);
  })]); } finally { clearTimeout(timer); }
}
export function createMembershipReader(deps: { session(): PromiseLike<SessionResult>; request: typeof fetch }) {
  let revision = 0;
  const pending = new Map<string, Promise<Result>>();
  return {
    invalidate() { revision++; pending.clear(); },
    async read(userId: string): Promise<Result> {
      try {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw Error("Sign in again to verify membership.");
        const session = await readDeadline(deps.session, 10000);
        if (session.error || session.data.session?.user.id !== userId) throw Error("Your account changed. Sign in again.");
        const token = session.data.session.access_token, captured = revision, key = userId + ":" + token;
        const existing = pending.get(key); if (existing) return existing;
        const work = (async (): Promise<Result> => {
          const controller = new AbortController();
          try {
            const payload = await readDeadline(async () => {
              const response = await deps.request("/api/membership", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal: controller.signal });
              if (!response.ok) throw Error("Membership could not be verified. Please try again.");
              return response.json();
            }, 20000);
            if (payload?.owner !== userId || !("subscription" in payload)) throw Error("Membership could not be verified.");
            const membership = parseEffectiveMembership(payload.subscription);
            const current = await readDeadline(deps.session, 10000);
            if (current.error || current.data.session?.user.id !== userId || current.data.session.access_token !== token || captured !== revision) throw Error("Your account changed. Refresh to verify membership.");
            return { data: membership, error: null };
          } catch (error) { return { data: null, error: error instanceof Error ? error : Error("Membership could not be verified.") }; }
          finally { controller.abort(); }
        })();
        pending.set(key, work);
        try { return await work; } finally { if (pending.get(key) === work) pending.delete(key); }
      } catch (error) { return { data: null, error: error instanceof Error ? error : Error("Membership could not be verified.") }; }
    },
  };
}
