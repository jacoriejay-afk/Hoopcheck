// Owner-confirmed App Store Connect catalog, 2026-11-19. Display live StoreKit
// localized prices; these USD amounts are validation/reference values only.
export const APPLE_BUNDLE_ID = "online.hoopcheck.app";
export const APPLE_APP_ID = 6835366982;
export const APPLE_MEMBERSHIP_GROUP = "HoopCheck Membership";
export const APPLE_PRODUCTS = [
  { id: "hoopcheck.pro.monthly", plan: "pro", interval: "month", months: 1, usdMinor: 499, trialDays: 7 },
  { id: "hoopcheck.pro.6month", plan: "pro", interval: "6_month", months: 6, usdMinor: 2695, trialDays: 0 },
  { id: "hoopcheck.pro.annual", plan: "pro", interval: "year", months: 12, usdMinor: 5090, trialDays: 0 },
  { id: "hoopcheck.premium.monthly", plan: "premium", interval: "month", months: 1, usdMinor: 999, trialDays: 7 },
  { id: "hoopcheck.premium.6month", plan: "premium", interval: "6_month", months: 6, usdMinor: 5395, trialDays: 0 },
  { id: "hoopcheck.premium.annual", plan: "premium", interval: "year", months: 12, usdMinor: 10190, trialDays: 0 },
] as const;
export type AppleProduct = typeof APPLE_PRODUCTS[number];
export function appleProduct(id: unknown): AppleProduct | null { return APPLE_PRODUCTS.find(product => product.id === id) ?? null; }
export function canPurchaseAppleMembership(role: string) {
  // No fan products have been priced. This changes purchasing only; existing
  // fan entitlements and restored ownership remain independently authoritative.
  return ["player", "coach", "scout", "agent", "club_admin", "manager"].includes(role);
}
