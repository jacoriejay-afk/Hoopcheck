export type EffectiveMembership = {
  plan: "pro" | "premium" | null;
  status: string;
  access_status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_interval: "month" | "6_month" | "year";
  provider: "apple" | "stripe" | "manual";
};
