import type {
  AppleNotificationVerifier,
  VerifiedAppleNotification,
  VerifiedAppleRenewalInfo,
  VerifiedAppleTransaction,
} from "./apple-iap-notification-handler";
import type { AppleVerifierConfiguration } from "./apple-iap-verifier-config";

/**
 * Minimal structural surface of @apple/app-store-server-library.
 *
 * Inject the real module from the server-only composition root. Keeping the
 * package boundary explicit lets the orchestration tests run without pretending
 * a mock verifier is cryptographic verification.
 */
export type AppleServerLibraryModule = {
  Environment: {
    PRODUCTION: unknown;
    SANDBOX: unknown;
  };
  SignedDataVerifier: new (
    rootCertificates: Buffer[],
    enableOnlineChecks: boolean,
    environment: unknown,
    bundleId: string,
    appAppleId?: number,
  ) => {
    verifyAndDecodeNotification(signedPayload: string): Promise<unknown>;
    verifyAndDecodeTransaction(signedTransaction: string): Promise<unknown>;
    verifyAndDecodeRenewalInfo(signedRenewalInfo: string): Promise<unknown>;
  };
};

export class AppleVerifierAdapterConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppleVerifierAdapterConfigurationError";
  }
}

/**
 * Adapts Apple's official SignedDataVerifier to HoopCheck's notification
 * handler contract. Call only from a server-only module after loading
 * @apple/app-store-server-library and validated server configuration.
 *
 * This adapter does not persist transactions, identify a HoopCheck user, or
 * grant entitlements. Those actions belong to the separately audited adapter.
 */
export function createAppleNotificationVerifier(
  library: AppleServerLibraryModule,
  config: AppleVerifierConfiguration,
  enableOnlineChecks = true,
): AppleNotificationVerifier {
  if (!config.bundleId || config.bundleId === "com.example.hoopcheck") {
    throw new AppleVerifierAdapterConfigurationError(
      "A permanent Apple bundle ID is required.",
    );
  }
  if (!Array.isArray(config.rootCertificates) || config.rootCertificates.length === 0) {
    throw new AppleVerifierAdapterConfigurationError(
      "At least one Apple root certificate is required.",
    );
  }

  let environment: unknown;
  if (config.environment === "Production") {
    if (!Number.isSafeInteger(config.appAppleId) || Number(config.appAppleId) <= 0) {
      throw new AppleVerifierAdapterConfigurationError(
        "Production verification requires a valid numeric Apple app ID.",
      );
    }
    environment = library.Environment.PRODUCTION;
  } else if (config.environment === "Sandbox") {
    environment = library.Environment.SANDBOX;
  } else {
    throw new AppleVerifierAdapterConfigurationError(
      "Only explicitly configured Production or Sandbox verification is supported.",
    );
  }

  const verifier = new library.SignedDataVerifier(
    config.rootCertificates,
    enableOnlineChecks,
    environment,
    config.bundleId,
    config.appAppleId,
  );

  return {
    async verifyAndDecodeNotification(signedPayload): Promise<VerifiedAppleNotification> {
      return (await verifier.verifyAndDecodeNotification(signedPayload)) as VerifiedAppleNotification;
    },
    async verifyAndDecodeTransaction(signedTransaction): Promise<VerifiedAppleTransaction> {
      return (await verifier.verifyAndDecodeTransaction(signedTransaction)) as VerifiedAppleTransaction;
    },
    async verifyAndDecodeRenewalInfo(signedRenewalInfo): Promise<VerifiedAppleRenewalInfo> {
      return (await verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo)) as VerifiedAppleRenewalInfo;
    },
  };
}
