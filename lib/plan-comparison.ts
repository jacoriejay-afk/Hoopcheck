import { getSubscriptionProduct } from "./subscription-products";

export type MembershipAudience = "fan" | "player";
export type PlanTier = "free" | "pro" | "premium";
export type BillingTerm = "month" | "6_month" | "year";

// Player prices are derived from the approved product catalog.
// Do not use these values to price Fan or other role subscriptions.
function playerPrice(tier: "pro" | "premium", duration: BillingTerm): string {
  const product = getSubscriptionProduct("player", tier, duration);
  if (!product) throw new Error(`Missing approved Player product: ${tier}/${duration}`);
  return product.displayPrice;
}

export const PLAN_PRICES = {
  pro: { month: playerPrice("pro", "month"), "6_month": playerPrice("pro", "6_month"), year: playerPrice("pro", "year") },
  premium: { month: playerPrice("premium", "month"), "6_month": playerPrice("premium", "6_month"), year: playerPrice("premium", "year") },
};
export const BILLING_LABELS = { month: "billed monthly", "6_month": "billed every 6 months", year: "billed annually" } as const;
export const PLAN_PERKS: Record<MembershipAudience, readonly { label: string; minimum: "pro" | "premium" }[]> = {
  fan: [
    { label: "Follow all teams", minimum: "pro" },
    { label: "Fan HoopFeed and team updates", minimum: "pro" },
    { label: "Live game chats", minimum: "pro" },
    { label: "Game alerts and team activity", minimum: "pro" },
    { label: "Full team ratings and reviews", minimum: "premium" },
  ],
  player: [
    { label: "Full coach ratings and reviews", minimum: "pro" },
    { label: "Full team ratings and reviews", minimum: "pro" },
    { label: "Full league ratings and reviews", minimum: "pro" },
    { label: "Player HoopFeed: posts, photos, and community", minimum: "pro" },
    { label: "Coach research", minimum: "pro" },
    { label: "Team research", minimum: "pro" },
    { label: "League research", minimum: "pro" },
  ],
};
