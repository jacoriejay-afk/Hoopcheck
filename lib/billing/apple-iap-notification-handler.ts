/**
 * Framework-neutral, fail-closed orchestration for App Store Server Notifications V2.
 *
 * This function is intentionally not an HTTP route and has no database client.
 * The production adapter must supply Apple's SignedDataVerifier methods and an
 * idempotent persistence/reconciliation implementation. Do not pass decoded
 * client payloads here: verifier methods must perform cryptographic verification.
 */
export type VerifiedAppleNotification = {
  notificationUUID?: string | null;
  notificationType?: string | null;
  subtype?: string | null;
  data?: {
    bundleId?: string | null;
    environment?: string | null;
    signedTransactionInfo?: string | null;
    signedRenewalInfo?: string | null;
  } | null;
};

export type VerifiedAppleTransaction = {
  transactionId?: string | null;
  originalTransactionId?: string | null;
  bundleId?: string | null;
  productId?: string | null;
  environment?: string | null;
  appAccountToken?: string | null;
  expiresDate?: number | null;
  revocationDate?: number | null;
  purchaseDate?: number | null;
};

export type VerifiedAppleRenewalInfo = {
  autoRenewStatus?: number | null;
  expirationIntent?: number | null;
  gracePeriodExpiresDate?: number | null;
  isInBillingRetryPeriod?: boolean | null;
  originalTransactionId?: string | null;
  productId?: string | null;
  renewalDate?: number | null;
};

export type AppleNotificationVerifier = {
  verifyAndDecodeNotification(signedPayload: string): Promise<VerifiedAppleNotification>;
  verifyAndDecodeTransaction(signedTransaction: string): Promise<VerifiedAppleTransaction>;
  verifyAndDecodeRenewalInfo(signedRenewalInfo: string): Promise<VerifiedAppleRenewalInfo>;
};

export type AppleNotificationPersistence = {
  /**
   * Must atomically insert by notification UUID and return false if it already
   * exists. Store a minimal audit record; never treat an unverified payload as
   * an entitlement update.
   */
  recordVerifiedNotification(input: {
    notificationUUID: string;
    notificationType: string;
    environment: string;
  }): Promise<{ inserted: boolean; processed: boolean }>;
  /**
   * Reconcile using verified transaction/renewal data and trusted account
   * ownership. Implementations must be idempotent and must not overwrite
   * Stripe-owned subscription columns.
   */
  reconcileVerifiedNotification(input: {
    notification: VerifiedAppleNotification;
    transaction: VerifiedAppleTransaction | null;
    renewalInfo: VerifiedAppleRenewalInfo | null;
  }): Promise<void>;
  /** Mark processed only after reconciliation commits successfully. */
  markNotificationProcessed(notificationUUID: string): Promise<void>;
};

export type AppleNotificationResult =
  | { outcome: "recorded"; notificationUUID: string }
  | { outcome: "duplicate"; notificationUUID: string };

export class AppleNotificationRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppleNotificationRejectedError";
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Verify outer and nested signed data before any persistence or reconciliation.
 * A malformed, unverifiable, wrong-bundle, or unsupported-environment payload
 * fails before writes. Database adapters must additionally bind the transaction
 * to an authenticated HoopCheck user/appAccountToken before granting access.
 */
export async function handleAppleServerNotification(input: {
  signedPayload: string;
  expectedBundleId: string;
  verifier: AppleNotificationVerifier;
  persistence: AppleNotificationPersistence;
  allowedEnvironments?: readonly string[];
}): Promise<AppleNotificationResult> {
  if (!isNonEmptyString(input.signedPayload)) {
    throw new AppleNotificationRejectedError("Missing signedPayload.");
  }
  if (!isNonEmptyString(input.expectedBundleId)) {
    throw new AppleNotificationRejectedError("Expected bundle ID is not configured.");
  }

  // Cryptographic verification is deliberately the first operation with data.
  const notification = await input.verifier.verifyAndDecodeNotification(input.signedPayload);
  const notificationUUID = notification.notificationUUID;
  const notificationType = notification.notificationType;
  const bundleId = notification.data?.bundleId;
  const environment = notification.data?.environment;

  if (!isNonEmptyString(notificationUUID) || !isNonEmptyString(notificationType)) {
    throw new AppleNotificationRejectedError("Verified notification lacks its UUID or type.");
  }
  if (bundleId !== input.expectedBundleId) {
    throw new AppleNotificationRejectedError("Verified notification bundle ID does not match.");
  }
  const allowedEnvironments = input.allowedEnvironments ?? ["Sandbox", "Production"];
  if (!isNonEmptyString(environment) || !allowedEnvironments.includes(environment)) {
    throw new AppleNotificationRejectedError("Verified notification environment is not allowed.");
  }

  let transaction: VerifiedAppleTransaction | null = null;
  let renewalInfo: VerifiedAppleRenewalInfo | null = null;

  // Verify every nested signed object before the first database write.
  if (notification.data?.signedTransactionInfo) {
    transaction = await input.verifier.verifyAndDecodeTransaction(
      notification.data.signedTransactionInfo,
    );
    if (
      transaction.bundleId !== input.expectedBundleId ||
      transaction.environment !== environment
    ) {
      throw new AppleNotificationRejectedError(
        "Verified transaction bundle ID or environment does not match the notification.",
      );
    }
  }

  if (notification.data?.signedRenewalInfo) {
    renewalInfo = await input.verifier.verifyAndDecodeRenewalInfo(
      notification.data.signedRenewalInfo,
    );
    if (
      renewalInfo.originalTransactionId &&
      transaction?.originalTransactionId &&
      renewalInfo.originalTransactionId !== transaction.originalTransactionId
    ) {
      throw new AppleNotificationRejectedError(
        "Verified renewal info does not match the transaction chain.",
      );
    }
  }

  const ledger = await input.persistence.recordVerifiedNotification({
    notificationUUID,
    notificationType,
    environment,
  });

  // A previously inserted but unprocessed event must be retried: it may have
  // failed during reconciliation after the first ledger write.
  if (!ledger.inserted && ledger.processed) {
    return { outcome: "duplicate", notificationUUID };
  }

  await input.persistence.reconcileVerifiedNotification({
    notification,
    transaction,
    renewalInfo,
  });
  await input.persistence.markNotificationProcessed(notificationUUID);

  return { outcome: ledger.inserted ? "recorded" : "duplicate", notificationUUID };
}
