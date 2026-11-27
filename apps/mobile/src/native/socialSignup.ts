// Candidate-only social signup. Server role and provider validation remain authoritative.
export type PendingSignup = { owner: string; provider: "apple" | "google" };
export type SignupIdentity = { id: string; role?: string; app_metadata?: { provider?: unknown } };
type SignupSession = { access_token: string; user: SignupIdentity } | null;

export function pendingSignup(user: SignupIdentity | null | undefined): PendingSignup | null {
  const provider = user?.app_metadata?.provider;
  if (!user?.id || user.role !== "hoopcheck_pending_signup" || (provider !== "apple" && provider !== "google")) return null;
  return { owner: user.id, provider };
}

type Dependencies = {
  session: () => Promise<SignupSession>;
  verifiedUser: (token: string) => Promise<SignupIdentity | null>;
  submit: (rpc: "complete_apple_signup" | "complete_google_signup", token: string, signup: Record<string, unknown>) => Promise<void>;
  refresh: () => Promise<SignupSession>;
};

// The RPC must use the captured owner's bearer, never the mutable SDK default
// session. A newer login may change the default while a form is in flight.
export async function completePendingSignup(expected: PendingSignup, signup: Record<string, unknown>, deps: Dependencies) {
  const before = await deps.session();
  if (!before?.access_token || before.user.id !== expected.owner) throw new Error("Your account changed. Sign in again.");
  const verified = pendingSignup(await deps.verifiedUser(before.access_token));
  if (!verified || verified.owner !== expected.owner || verified.provider !== expected.provider) throw new Error("Verify your social account again.");
  if ((await deps.session())?.user.id !== expected.owner) throw new Error("Your account changed. Sign in again.");
  await deps.submit(expected.provider === "apple" ? "complete_apple_signup" : "complete_google_signup", before.access_token, signup);
  if ((await deps.session())?.user.id !== expected.owner) throw new Error("Your account changed. Sign in again.");
  const after = await deps.refresh();
  if (after?.user.id !== expected.owner || after.user.role !== "authenticated") throw new Error("Account setup may be complete. Sign in again to verify access.");
  return after.user.id;
}
