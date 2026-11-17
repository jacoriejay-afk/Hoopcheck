export const lockAfter = 5 * 60 * 1000;
export function backgroundRequiresLock(leftAt: number | null, now: number) {
  // Missing/invalid restoration state is not evidence that an account is unlocked.
  return leftAt === null || !Number.isFinite(leftAt) || leftAt > now || now - leftAt >= lockAfter;
}

let freshSignInUntil = 0;
// Called only after an actual password/signup response succeeds, never on token refresh.
export function recordFreshSignIn(now = Date.now()) { freshSignInUntil = now + 30000; }
export function consumeFreshSignIn(now = Date.now()) {
  const fresh = freshSignInUntil > now;
  freshSignInUntil = 0;
  return fresh;
}
