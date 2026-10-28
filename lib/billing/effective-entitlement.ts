/**
 * Provider-neutral entitlement resolution primitives.
 *
 * IMPORTANT:
 * - This module is intentionally not wired into routes or RLS policies yet.
 * - Callers may pass Apple records here only after server-side Apple signature,
 *   bundle/product, environment, ownership, revocation, and expiry validation.
 * - Existing direct reads of public.subscriptions and SQL RLS policies still
 *   control current access until a separately reviewed integration replaces them.
 */
export type PaidPlan = "pro" | "premium";

export type StripeEntitlementCandidate = {
  plan: string | null;
  status: string | null;
  accessStatus?: string | null;
  currentPeriodEnd?: string | null;
};

export type AppleEntitlementCandidate = {
  plan: string | null;
  status: string | null;
  environment: string | null;
  currentPeriodEnd?: string | null;
  revokedAt?: string | null;
  lastVerifiedAt?: string | null;
};

export type EffectiveEntitlement = {
  plan: "free" | PaidPlan;
  sources: Array<"stripe" | "apple">;
};

/**
 * An absent period end is treated as non-expiring only for Stripe, matching the
 * existing web schema's nullable current_period_end convention. Apple must have
 * an expiry for auto-renewable subscriptions to be considered currently active.
 */
function periodIsValid(periodEnd: string | null | undefined, nowMs: number, allowNull: boolean) {
  if (!periodEnd) return allowNull;
  const endMs = Date.parse(periodEnd);
  return Number.isFinite(endMs) && endMs > nowMs;
}

function isPaidPlan(plan: string | null | undefined): plan is PaidPlan {
  return plan === "pro" || plan === "premium";
}

function planRank(plan: PaidPlan) {
  return plan === "premium" ? 2 : 1;
}

/**
 * Resolve a best-effort display/access candidate from already trusted provider
 * records. This function does not verify transactions or persist any state.
 * Apple sandbox/Xcode rows never grant production access.
 */
export function resolveEffectiveEntitlement(input: {
  stripe?: StripeEntitlementCandidate | null;
  apple?: AppleEntitlementCandidate[] | null;
  now?: Date;
}): EffectiveEntitlement {
  const nowMs = (input.now ?? new Date()).getTime();
  const candidates: Array<{ plan: PaidPlan; source: "stripe" | "apple" }> = [];

  const stripe = input.stripe;
  if (
    stripe &&
    isPaidPlan(stripe.plan) &&
    (stripe.status === "active" || stripe.status === "trialing") &&
    (stripe.accessStatus == null ||
      stripe.accessStatus === stripe.plan ||
      stripe.accessStatus === "active" ||
      stripe.accessStatus === "trialing") &&
    periodIsValid(stripe.currentPeriodEnd, nowMs, true)
  ) {
    candidates.push({ plan: stripe.plan, source: "stripe" });
  }

  for (const apple of input.apple ?? []) {
    if (
      !isPaidPlan(apple.plan) ||
      apple.environment !== "Production" ||
      (apple.status !== "active" && apple.status !== "grace_period") ||
      apple.revokedAt ||
      !apple.lastVerifiedAt ||
      !periodIsValid(apple.currentPeriodEnd, nowMs, false)
    ) {
      continue;
    }

    candidates.push({ plan: apple.plan, source: "apple" });
  }

  if (candidates.length === 0) return { plan: "free", sources: [] };

  const highestRank = Math.max(...candidates.map(({ plan }) => planRank(plan)));
  const highest = candidates.filter(({ plan }) => planRank(plan) === highestRank);
  return {
    plan: highest[0].plan,
    sources: [...new Set(highest.map(({ source }) => source))],
  };
}
