import { readWithDeadline } from "./readDeadline";

type Session = { user: { id: string; role?: string } } | null;
export type StartupSession = { ready: boolean; userId: string | null; error: string | null; pendingSocialSignup?: true };

// Supabase auth callbacks stay synchronous; starting another auth operation
// inside one can wait on the very lock held by that callback.
export function createSessionBootstrap(
  read: () => Promise<{ data: { session: Session }; error?: unknown }>,
  subscribe: (receive: (session: Session) => void) => () => void,
  publish: (state: StartupSession) => void,
  deadline = 10000,
) {
  let alive = true;
  let revision = 0;
  let attempt = 0;
  let userId: string | null = null;
  let pendingSocialSignup = false;
  const pendingFlag = () => pendingSocialSignup ? { pendingSocialSignup: true as const } : {};
  const unsubscribe = subscribe(session => {
    if (!alive) return;
    revision++;
    userId = session?.user.id ?? null;
    pendingSocialSignup = session?.user.role === "hoopcheck_pending_signup";
    publish({ ready: true, userId, error: null, ...pendingFlag() });
  });
  async function retry() {
    if (!alive) return;
    const current = ++attempt;
    const authRevision = revision;
    publish({ ready: false, userId, error: null, ...pendingFlag() });
    try {
      const result = await readWithDeadline(read, deadline);
      if (result.error) throw result.error;
      if (!alive || current !== attempt || revision !== authRevision) return;
      userId = result.data.session?.user.id ?? null;
      pendingSocialSignup = result.data.session?.user.role === "hoopcheck_pending_signup";
      publish({ ready: true, userId, error: null, ...pendingFlag() });
    } catch {
      if (!alive || current !== attempt || revision !== authRevision) return;
      // Unknown session state is not equivalent to being signed out.
      publish({ ready: false, userId, error: "Couldn’t restore your sign-in. Please try again.", ...pendingFlag() });
    }
  }
  if (revision === 0) void retry();
  return { retry, dispose() { alive = false; attempt++; unsubscribe(); } };
}
