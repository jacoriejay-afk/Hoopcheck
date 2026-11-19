export type EffectiveMembership = {
  plan: "pro" | "premium" | null;
  status: string;
  access_status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_interval: "month" | "6_month" | "year";
  provider: "apple" | "stripe" | "manual";
};

export function parseEffectiveMembership(value: unknown): EffectiveMembership | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Membership could not be verified.");
  const row = value as Record<string, unknown>;
  if (![null, "pro", "premium"].includes(row.plan as null | string) || typeof row.status !== "string" ||
    typeof row.access_status !== "string" || !(row.current_period_end === null || typeof row.current_period_end === "string" && Number.isFinite(Date.parse(row.current_period_end))) ||
    typeof row.cancel_at_period_end !== "boolean" || !["month", "6_month", "year"].includes(String(row.billing_interval)) || !["apple", "stripe", "manual"].includes(String(row.provider))) throw Error("Membership could not be verified.");
  return row as EffectiveMembership;
}
