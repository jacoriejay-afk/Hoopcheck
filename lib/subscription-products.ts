/**
 * SUB-1: Approved product catalog. Fan and other role prices are intentionally
 * unavailable until approved; never use player prices for another role.
 */
export type SubscriptionRole = "player" | "fan" | "coach" | "agent" | "scout" | "club_admin";
export type SubscriptionTier = "pro" | "premium";
export type SubscriptionDuration = "month" | "6_month" | "year";
export type SubscriptionPlatform = "web" | "ios" | "android";

export type SubscriptionProduct = Readonly<{
  role: SubscriptionRole;
  tier: SubscriptionTier;
  duration: SubscriptionDuration;
  displayPrice: string;
  amountCents: number;
  currency: "USD";
  stripeLookupKey: string;
  iosProductId: string;
  androidProductId: string;
  trialDays: 7 | null;
}>;

const approvedPlayerPrices = {
  pro: {
    month: { cents: 499, display: "$4.99", lookup: "hoopcheck_pro_monthly_499_2026", product: "hoopcheck.pro.monthly" },
    "6_month": { cents: 2695, display: "$26.95", lookup: "hoopcheck_pro_6_month_2695_2026", product: "hoopcheck.pro.6month" },
    year: { cents: 5090, display: "$50.90", lookup: "hoopcheck_pro_year_5090_2026", product: "hoopcheck.pro.annual" },
  },
  premium: {
    month: { cents: 999, display: "$9.99", lookup: "hoopcheck_premium_monthly_999_2026", product: "hoopcheck.premium.monthly" },
    "6_month": { cents: 5395, display: "$53.95", lookup: "hoopcheck_premium_6_month_5395_2026", product: "hoopcheck.premium.6month" },
    year: { cents: 10190, display: "$101.90", lookup: "hoopcheck_premium_year_10190_2026", product: "hoopcheck.premium.annual" },
  },
} as const;

const tiers = ["pro", "premium"] as const;
const durations = ["month", "6_month", "year"] as const;

export const SUBSCRIPTION_PRODUCTS: readonly SubscriptionProduct[] = tiers.flatMap(tier =>
  durations.map(duration => {
    const item = approvedPlayerPrices[tier][duration];
    return {
      role: "player" as const,
      tier,
      duration,
      displayPrice: item.display,
      amountCents: item.cents,
      currency: "USD" as const,
      stripeLookupKey: item.lookup,
      iosProductId: item.product,
      androidProductId: item.product,
      trialDays: duration === "month" ? 7 as const : null,
    };
  })
);

export function getSubscriptionProduct(
  role: string | null | undefined,
  tier: string | null | undefined,
  duration: string | null | undefined,
): SubscriptionProduct | null {
  return SUBSCRIPTION_PRODUCTS.find(product =>
    product.role === role && product.tier === tier && product.duration === duration
  ) ?? null;
}

export function getSubscriptionProductsForRole(role: string | null | undefined): readonly SubscriptionProduct[] {
  return SUBSCRIPTION_PRODUCTS.filter(product => product.role === role);
}

export function getTrialOfferCopy(product: SubscriptionProduct): string | null {
  return product.trialDays === 7 && product.duration === "month"
    ? `Free for 7 days, then ${product.displayPrice}/month. Cancel anytime.`
    : null;
}
