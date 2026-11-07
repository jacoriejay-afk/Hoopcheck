export type MembershipAudience = "fan" | "player";
export type PlanTier = "free" | "pro" | "premium";
export type BillingTerm = "month" | "6_month" | "year";

// Existing checkout display values, pending Stripe/AUDIT-5 reconciliation.
export const PLAN_PRICES = {
  pro: { month: "$4.99", "6_month": "$25.45", year: "$53.89" },
  premium: { month: "$9.99", "6_month": "$50.95", year: "$107.89" },
} as const;
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
    { label: "Coach research", minimum: "pro" },
    { label: "Team research", minimum: "pro" },
    { label: "League research", minimum: "pro" },
  ],
};
