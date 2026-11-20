export const lockAfter = 5 * 60 * 1000;
export function lockScreenRequired(authReady: boolean, preferencesReady: boolean, protectedScreen: boolean, appLock: boolean, locked: boolean) {
  return !authReady || !preferencesReady || (protectedScreen && appLock && locked);
}
export function backgroundRequiresLock(leftAt: number | null, now: number) {
  // Missing/invalid restoration state is not evidence that an account is unlocked.
  return leftAt === null || !Number.isFinite(leftAt) || leftAt > now || now - leftAt >= lockAfter;
}

let freshSignInUntil = 0;
let freshSignInUser: string | null = null;
// Called only after an actual password/signup response succeeds, never on token refresh.
export function recordFreshSignIn(userId: string, now = Date.now()) { freshSignInUser = userId; freshSignInUntil = now + 30000; }
export function consumeFreshSignIn(userId: string, now = Date.now()) {
  const fresh = freshSignInUntil > now && freshSignInUser === userId;
  freshSignInUntil = 0; freshSignInUser = null;
  return fresh;
}
