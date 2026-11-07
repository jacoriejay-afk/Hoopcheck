export type MembershipTier = "free" | "pro" | "premium";
export type HoopCheckAccountType = "player" | "fan" | "coach" | "agent" | "club_admin" | "admin" | string;

export type HoopCheckEntitlements = {
  tier: MembershipTier;
  hasPaidMembership: boolean;
  canReadFullReviews: boolean;
  canViewTrustScore: boolean;
  canWriteReviews: boolean;
  canUseLiveGameHub: boolean;
  canUseLiveGameChat: boolean;
  canCompare: boolean;
  canUseContractCheck: boolean;
  canUseProPassport: boolean;
  canUsePayOnTimeIndex: boolean;
  canViewTeamPayHistory: boolean;
};



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

/**
 * The single role + subscription entitlement resolver used by pages and APIs.
 * Premium inherits every Pro entitlement because all plan checks are minimum-tier
 * comparisons; account-role rules remain separate from subscription level.
 */
export function getActiveMembershipTier(
  subscription: ActiveMembership | null | undefined,
  now = Date.now(),
): MembershipTier {
  if (hasActiveMembershipAtLeast(subscription, "premium", now)) return "premium";
  if (hasActiveMembershipAtLeast(subscription, "pro", now)) return "pro";
  return "free";
}

export function getHoopCheckEntitlements(args: {
  accountType: HoopCheckAccountType | null | undefined;
  subscription?: ActiveMembership | null;
  isAdmin?: boolean;
  now?: number;
}): HoopCheckEntitlements {
  const role = args.accountType || "";
  const isAdmin = args.isAdmin === true || role === "admin";
  const tier = isAdmin ? "premium" : getActiveMembershipTier(args.subscription, args.now);
  const active = isAdmin || tier !== "free";
  const isPlayer = role === "player";
  const isFan = role === "fan";
  const otherMember = Boolean(role) && !isPlayer && !isFan;

  return {
    tier,
    hasPaidMembership: active,
    canReadFullReviews: isAdmin || (isPlayer && isAtLeastTier(tier, "pro")) ||
      (isFan && isAtLeastTier(tier, "premium")) || (otherMember && active),
    canViewTrustScore: isAdmin || (isPlayer && isAtLeastTier(tier, "pro")) || (isFan && isAtLeastTier(tier, "premium")) || (otherMember && active),
    canWriteReviews: isPlayer && isAtLeastTier(tier, "pro"),
    canUseLiveGameHub: isAdmin || (isPlayer && isAtLeastTier(tier, "pro")) ||
      (isFan && isAtLeastTier(tier, "premium")),
    canUseLiveGameChat: isAdmin || (isPlayer && isAtLeastTier(tier, "pro")) ||
      (isFan && isAtLeastTier(tier, "premium")),
    canCompare: isAdmin || ((isPlayer || isFan) && isAtLeastTier(tier, "pro")) || (otherMember && active),
    canUseContractCheck: isAdmin || (isPlayer && isAtLeastTier(tier, "pro")) || (otherMember && active),
    canUseProPassport: isAdmin || (role === "agent" && isAtLeastTier(tier, "pro")) ||
      (isPlayer && isAtLeastTier(tier, "pro")),
    canUsePayOnTimeIndex: isAdmin || (isPlayer && isAtLeastTier(tier, "pro")) || (otherMember && active),
    canViewTeamPayHistory: Boolean(role) && !isFan,
  };
}
