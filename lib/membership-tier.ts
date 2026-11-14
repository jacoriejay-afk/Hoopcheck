export type MembershipTier = "free" | "pro" | "premium";
export type HoopCheckAccountType = "player" | "fan" | "coach" | "agent" | "club_admin" | "admin" | string;

export type HoopCheckEntitlements = {
  tier: MembershipTier;
  hasPaidMembership: boolean;
  canReadHoopFeed: boolean;
  canWriteHoopFeed: boolean;
  canReadFanFeed: boolean;
  canWriteFanFeed: boolean;
  canReadFullReviews: boolean;
  canViewTrustScore: boolean;
  canWriteReviews: boolean;
  canUseLiveGameHub: boolean;
  canUseLiveGameChat: boolean;
  canCompare: boolean;
  canUseContractCheck: boolean;
  canUseProPassport: boolean;
  canUseRecruitingNetwork: boolean;
  canUsePayOnTimeIndex: boolean;
  canUseAskPlayer: boolean;
  canConnectWithFans: boolean;
  canSwitchBasketballSide: boolean;
  canStartCoachIdentityVerification: boolean;
  canViewTeamPayHistory: boolean;
  canSubmitPayCheckIn: boolean;
  canUseFanGroups: boolean;
  canModerateFanGroups: boolean;
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
  if (subscription.current_period_end) {
    const periodEnd = new Date(subscription.current_period_end).getTime();
    if (!Number.isFinite(periodEnd) || periodEnd <= now) return false;
  }
  return true;
}

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
  playerVerified?: boolean;
  now?: number;
}): HoopCheckEntitlements {
  const role = args.accountType || "";
  const isAdmin = args.isAdmin === true || role === "admin";
  const tier = isAdmin ? "premium" : getActiveMembershipTier(args.subscription, args.now);
  const active = isAdmin || tier !== "free";
  const isPlayer = role === "player";
  const isFan = role === "fan";
  const recognizedRole = ["player", "fan", "coach", "scout", "agent", "club_admin", "admin"].includes(role);
  const otherMember = recognizedRole && !isPlayer && !isFan;
  const canUseHoopFeed = isAdmin || (
    recognizedRole && active
  );

  return {
    tier,
    hasPaidMembership: active,
    canReadHoopFeed: canUseHoopFeed,
    canWriteHoopFeed: canUseHoopFeed,
    canReadFanFeed: isFan && isAtLeastTier(tier, "pro"),
    canWriteFanFeed: isFan && isAtLeastTier(tier, "pro"),
    canReadFullReviews: isAdmin || (isPlayer && isAtLeastTier(tier, "pro")) ||
      (isFan && isAtLeastTier(tier, "premium")) || (otherMember && active),
    canViewTrustScore: isAdmin || (isPlayer && isAtLeastTier(tier, "pro")) || (isFan && isAtLeastTier(tier, "premium")) || (otherMember && active),
    canWriteReviews: isPlayer && args.playerVerified === true && isAtLeastTier(tier, "pro"),
    canUseLiveGameHub: isAdmin || ((isPlayer || isFan) && isAtLeastTier(tier, "pro")),
    canUseLiveGameChat: isAdmin || ((isPlayer || isFan) && isAtLeastTier(tier, "pro")),
    canCompare: isAdmin || ((isPlayer || isFan) && isAtLeastTier(tier, "pro")) || (otherMember && active),
    canUseContractCheck: isAdmin || (isPlayer && isAtLeastTier(tier, "pro")) || (otherMember && active),
    canUseProPassport: isAdmin || (role === "agent" && isAtLeastTier(tier, "pro")) ||
      (isPlayer && isAtLeastTier(tier, "premium")),
    canUseRecruitingNetwork: isPlayer && isAtLeastTier(tier, "premium"),
    canUsePayOnTimeIndex: isAdmin || (isPlayer && isAtLeastTier(tier, "pro")) || (otherMember && active),
    canUseAskPlayer: (isPlayer || role === "scout" || role === "agent") && isAtLeastTier(tier, "pro"),
    canConnectWithFans: isFan && isAtLeastTier(tier, "pro"),
    canSwitchBasketballSide: isFan && isAtLeastTier(tier, "pro"),
    canStartCoachIdentityVerification: role === "coach" && isAtLeastTier(tier, "pro"),
    canViewTeamPayHistory: recognizedRole && !isFan,
    canSubmitPayCheckIn: isPlayer && args.playerVerified === true && isAtLeastTier(tier, "pro"),
    canUseFanGroups: isFan,
    canModerateFanGroups: isAdmin || role === "club_admin",
  };
}
