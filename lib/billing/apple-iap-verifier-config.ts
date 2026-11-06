/**
 * Validates the server-only configuration needed to construct Apple's
 * SignedDataVerifier. This module does not decode or trust client payloads.
 *
 * APPLE_ROOT_CA_CERTIFICATES_BASE64 is a comma-separated list of base64-encoded
 * DER Apple Root CA certificates, not PEM text and not private keys.
 */
export type AppleVerificationEnvironment = "Sandbox" | "Production";

export type AppleVerifierConfiguration = {
  bundleId: string;
  environment: AppleVerificationEnvironment;
  appAppleId?: number;
  rootCertificates: Buffer[];
};

export class AppleIapConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppleIapConfigurationError";
  }
}

export function getAppleVerifierConfiguration(
  environment: AppleVerificationEnvironment,
  env: NodeJS.ProcessEnv = process.env,
): AppleVerifierConfiguration {
  const bundleId = env.APPLE_IAP_BUNDLE_ID?.trim();
  const rootsValue = env.APPLE_ROOT_CA_CERTIFICATES_BASE64?.trim();

  if (!bundleId || bundleId === "com.example.hoopcheck") {
    throw new AppleIapConfigurationError(
      "A permanent APPLE_IAP_BUNDLE_ID must be configured before verification is enabled.",
    );
  }

  if (!rootsValue) {
    throw new AppleIapConfigurationError(
      "Apple root certificates are not configured on the server.",
    );
  }

  const rootCertificates = rootsValue.split(",").map((value, index) => {
    const normalized = value.trim();
    if (
      !normalized ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) ||
      normalized.length % 4 !== 0
    ) {
      throw new AppleIapConfigurationError(
        `Apple root certificate ${index + 1} is not valid base64.`,
      );
    }

    const decoded = Buffer.from(normalized, "base64");
    if (decoded.length === 0 || decoded.toString("base64") !== normalized) {
      throw new AppleIapConfigurationError(
        `Apple root certificate ${index + 1} failed base64 validation.`,
      );
    }
    return decoded;
  });

  if (environment === "Production") {
    const appAppleId = env.APPLE_IAP_APPLE_ID?.trim();
    if (!appAppleId || !/^\d+$/.test(appAppleId) || Number(appAppleId) <= 0) {
      throw new AppleIapConfigurationError(
        "A valid numeric APPLE_IAP_APPLE_ID is required for Production verification.",
      );
    }

    return {
      bundleId,
      environment,
      appAppleId: Number(appAppleId),
      rootCertificates,
    };
  }

  return { bundleId, environment, rootCertificates };
}
