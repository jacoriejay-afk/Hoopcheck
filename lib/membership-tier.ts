export type MembershipTier = "free" | "pro" | "premium";

const TIER_RANK: Record<MembershipTier, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

export function isAtLeastTier(value: unknown, required: MembershipTier): boolean {
  const tier = value === "premium" || value === "pro" ? value : "free";
  return TIER_RANK[tier] >= TIER_RANK[required];
}

export type ActiveMembership = {
  plan?: string | null;
  status?: string | null;
  access_status?: string | null;
  current_period_end?: string | null;
};

export function hasActiveMembershipAtLeast(
  subscription: ActiveMembership | null | undefined,
  required: MembershipTier = "pro",
  now = Date.now(),
): boolean {
  if (!subscription || !isAtLeastTier(subscription.plan, required)) return false;
  if (!["active", "trialing"].includes(subscription.status || "")) return false;
  if (subscription.access_status && !["active", "trialing", "pro", "premium"].includes(subscription.access_status)) return false;
  if (subscription.current_period_end) {
    const periodEnd = new Date(subscription.current_period_end).getTime();
    if (!Number.isFinite(periodEnd) || periodEnd <= now) return false;
  }
  return true;
}
