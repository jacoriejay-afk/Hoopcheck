
export type AppleTransactionOwnershipResult =
  | { owned: true }
  | {
      owned: false;
      reason:
        | "unauthenticated"
        | "transaction_unverified"
        | "missing_transaction_token"
        | "missing_stored_token"
        | "token_mismatch";
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fail-closed ownership gate for user-initiated Apple transaction recovery.
 *
 * Call only after verifying the signed transaction with Apple's verifier.
 * expectedStoredToken must be loaded server-side from
 * apple_iap_account_tokens for the authenticated user; never accept it from
 * the client. This helper does not verify signatures or grant entitlements.
 */
export function checkAppleTransactionOwnership(input: {
  authenticatedUserId: string | null | undefined;
  transactionVerified: boolean;
  transactionAppAccountToken: string | null | undefined;
  expectedStoredToken: string | null | undefined;
}): AppleTransactionOwnershipResult {
  if (typeof input.authenticatedUserId !== "string" || !input.authenticatedUserId.trim()) {
    return { owned: false, reason: "unauthenticated" };
  }
  if (input.transactionVerified !== true) {
    return { owned: false, reason: "transaction_unverified" };
  }
  if (typeof input.transactionAppAccountToken !== "string" || !input.transactionAppAccountToken.trim()) {
    return { owned: false, reason: "missing_transaction_token" };
  }
  if (typeof input.expectedStoredToken !== "string" || !input.expectedStoredToken.trim()) {
    return { owned: false, reason: "missing_stored_token" };
  }
  if (
    !UUID_PATTERN.test(input.transactionAppAccountToken) ||
    !UUID_PATTERN.test(input.expectedStoredToken) ||
    input.transactionAppAccountToken.toLowerCase() !== input.expectedStoredToken.toLowerCase()
  ) {
    return { owned: false, reason: "token_mismatch" };
  }
  return { owned: true };
}
