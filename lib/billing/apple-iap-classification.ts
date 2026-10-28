/**
 * Apple App Store product mapping and notification classification.
 *
 * This module is deliberately pure: it does not verify JWS, persist events, or
 * grant entitlements. Callers must verify signed data with Apple's official
 * App Store Server Library before using any decoded fields.
 */

export type ApplePlan = "pro" | "premium";

export type AppleNotificationDecision =
  | "refresh_entitlement"
  | "record_only";

const PRODUCT_PLAN_ENV: Record<ApplePlan, string> = {
  pro: "APPLE_IAP_PRO_PRODUCT_ID",
  premium: "APPLE_IAP_PREMIUM_PRODUCT_ID",
};

/**
 * Return the exact product allowlist for server-side notification verification.
 * Missing or duplicated configuration returns an empty list so callers can
 * fail closed instead of accepting arbitrary App Store product identifiers.
 */
export function getAllowedAppleProductIds(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const proProductId = env[PRODUCT_PLAN_ENV.pro]?.trim();
  const premiumProductId = env[PRODUCT_PLAN_ENV.premium]?.trim();

  if (
    !proProductId ||
    !premiumProductId ||
    proProductId === premiumProductId
  ) {
    return [];
  }

  return [proProductId, premiumProductId];
}

export function getApplePlanForProductId(
  productId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ApplePlan | null {
  if (!productId) return null;

  const proProductId = env[PRODUCT_PLAN_ENV.pro];
  const premiumProductId = env[PRODUCT_PLAN_ENV.premium];

  // Fail closed if product IDs are absent or accidentally configured identically.
  if (!proProductId || !premiumProductId || proProductId === premiumProductId) {
    return null;
  }

  if (productId === proProductId) return "pro";
  if (productId === premiumProductId) return "premium";
  return null;
}

/**
 * Classifies V2 notification names only after the signed notification and any
 * nested signed transaction/renewal payloads have been cryptographically
 * verified. Even expiry/refund/revocation events trigger reconciliation rather
 * than a blind state mutation, so delayed/out-of-order notifications cannot
 * independently grant or remove access.
 */
export function classifyAppleNotification(
  notificationType: string | null | undefined,
  _subtype?: string | null,
): AppleNotificationDecision {
  switch (notificationType) {
    case "SUBSCRIBED":
    case "DID_RENEW":
    case "DID_RECOVER":
    case "OFFER_REDEEMED":
    case "PRICE_INCREASE":
    case "DID_CHANGE_RENEWAL_STATUS":
    case "DID_CHANGE_RENEWAL_PREF":
    case "RENEWAL_EXTENDED":
    case "REFUND_REVERSED":
    case "EXPIRED":
    case "GRACE_PERIOD_EXPIRED":
    case "REVOKE":
    case "REFUND":
      return "refresh_entitlement";

    case "DID_FAIL_TO_RENEW":
      // During billing retry / grace period, entitlement depends on the verified
      // renewal state and current policy; always refresh from verified status.
      return "refresh_entitlement";

    default:
      return "record_only";
  }
}
