export type AppleEntitlementCandidate = {
  plan: "pro" | "premium";
  status: "active" | "grace_period";
  environment: "Production";
  currentPeriodEnd: string;
  lastVerifiedAt: string;
  revokedAt: null;
};

export type VerifiedAppleTransactionForEntitlement = {
  transactionId?: string | null;
  originalTransactionId?: string | null;
  productId?: string | null;
  environment?: string | null;
  appAccountToken?: string | null;
  expiresDate?: number | null;
  revocationDate?: number | null;
};

export type VerifiedAppleRenewalForEntitlement = {
  gracePeriodExpiresDate?: number | null;
};

export type AppleEntitlementCandidateResult =
  | { accepted: true; candidate: AppleEntitlementCandidate }
  | {
      accepted: false;
      reason:
        | "unauthenticated"
        | "transaction_unverified"
        | "missing_transaction_token"
        | "missing_stored_token"
        | "token_mismatch"
        | "missing_transaction_identity"
        | "unknown_product"
        | "non_production_environment"
        | "revoked"
        | "invalid_expiration"
        | "expired";
    };

function isValidDateMillis(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Convert an already cryptographically verified Apple transaction into a
 * production entitlement candidate. This is a pure policy gate, not signature
 * verification or persistence. Sandbox, revoked, expired, unowned, and
 * unrecognized transactions are never accepted.
 */
export function buildAppleEntitlementCandidate(input: {
  authenticatedUserId: string | null | undefined;
  transactionVerified: boolean;
  transaction: VerifiedAppleTransactionForEntitlement;
  expectedStoredToken: string | null | undefined;
  renewalInfo?: VerifiedAppleRenewalForEntitlement | null;
  now?: Date;
}): AppleEntitlementCandidateResult {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!input.authenticatedUserId?.trim()) return { accepted: false, reason: "unauthenticated" };
  if (!input.transactionVerified) return { accepted: false, reason: "transaction_unverified" };
  if (!input.transaction.appAccountToken || !uuidPattern.test(input.transaction.appAccountToken)) {
    return { accepted: false, reason: "missing_transaction_token" };
  }
  if (!input.expectedStoredToken || !uuidPattern.test(input.expectedStoredToken)) {
    return { accepted: false, reason: "missing_stored_token" };
  }
  if (input.transaction.appAccountToken.toLowerCase() !== input.expectedStoredToken.toLowerCase()) {
    return { accepted: false, reason: "token_mismatch" };
  }

  if (
    !input.transaction.transactionId?.trim() ||
    !input.transaction.originalTransactionId?.trim() ||
    !input.transaction.productId?.trim()
  ) {
    return { accepted: false, reason: "missing_transaction_identity" };
  }

  const proProductId = process.env.APPLE_IAP_PRO_PRODUCT_ID;
  const premiumProductId = process.env.APPLE_IAP_PREMIUM_PRODUCT_ID;
  if (!proProductId || !premiumProductId || proProductId === premiumProductId) {
    return { accepted: false, reason: "unknown_product" };
  }
  const plan =
    input.transaction.productId === proProductId ? "pro" :
    input.transaction.productId === premiumProductId ? "premium" : null;
  if (!plan) return { accepted: false, reason: "unknown_product" };
  if (input.transaction.environment !== "Production") {
    return { accepted: false, reason: "non_production_environment" };
  }
  if (input.transaction.revocationDate != null) {
    return { accepted: false, reason: "revoked" };
  }
  if (!isValidDateMillis(input.transaction.expiresDate)) {
    return { accepted: false, reason: "invalid_expiration" };
  }

  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) {
    return { accepted: false, reason: "invalid_expiration" };
  }
  const expiration = new Date(input.transaction.expiresDate);
  const graceMillis = input.renewalInfo?.gracePeriodExpiresDate;
  const graceExpiration =
    isValidDateMillis(graceMillis) ? new Date(graceMillis) : null;
  const inGracePeriod =
    expiration.getTime() <= now.getTime() &&
    graceExpiration !== null &&
    graceExpiration.getTime() > now.getTime();

  if (expiration.getTime() <= now.getTime() && !inGracePeriod) {
    return { accepted: false, reason: "expired" };
  }

  return {
    accepted: true,
    candidate: {
      plan,
      status: inGracePeriod ? "grace_period" : "active",
      environment: "Production",
      currentPeriodEnd: (inGracePeriod ? graceExpiration! : expiration).toISOString(),
      lastVerifiedAt: now.toISOString(),
      revokedAt: null,
    },
  };
}
