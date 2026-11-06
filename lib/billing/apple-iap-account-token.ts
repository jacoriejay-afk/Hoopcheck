/**
 * Compare an Apple transaction's verified appAccountToken with the token
 * retrieved from the trusted server-side user mapping.
 *
 * This is only a comparison helper; callers must authenticate the user and
 * load expectedStoredToken from the server-only apple_iap_account_tokens table.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function matchesAppleAccountToken(
  transactionToken: string | null | undefined,
  expectedStoredToken: string | null | undefined,
): boolean {
  if (
    typeof transactionToken !== "string" ||
    typeof expectedStoredToken !== "string" ||
    !UUID_PATTERN.test(transactionToken) ||
    !UUID_PATTERN.test(expectedStoredToken)
  ) {
    return false;
  }

  return transactionToken.toLowerCase() === expectedStoredToken.toLowerCase();
}
