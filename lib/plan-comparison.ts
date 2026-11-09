export type MembershipAudience = "fan" | "player";
export type PlanTier = "free" | "pro" | "premium";
export type BillingTerm = "month" | "6_month" | "year";

// AUDIT-5 approved display prices; keep aligned with Stripe checkout configuration.
export const PLAN_PRICES = {
  pro: { month: "$4.99", "6_month": "$26.95", year: "$50.90" },
  premium: { month: "$9.99", "6_month": "$53.95", year: "$101.90" },
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
