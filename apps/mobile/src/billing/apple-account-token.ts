const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AppleAccountTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppleAccountTokenError";
  }
}

/**
 * Requests the stable StoreKit appAccountToken for the signed-in user.
 * The API origin must be the trusted HoopCheck deployment origin, never a
 * value supplied by an untrusted deep link or remote content.
 */
export async function getAppleAppAccountToken(
  apiOrigin: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!accessToken.trim()) {
    throw new AppleAccountTokenError("Sign in before starting an Apple purchase.");
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(apiOrigin);
  } catch {
    throw new AppleAccountTokenError("Apple purchases are not configured for this app.");
  }

  const isLocalDevelopment =
    parsedOrigin.hostname === "localhost" ||
    parsedOrigin.hostname === "127.0.0.1";
  if (
    (parsedOrigin.protocol !== "https:" && !isLocalDevelopment) ||
    parsedOrigin.username ||
    parsedOrigin.password ||
    parsedOrigin.search ||
    parsedOrigin.hash
  ) {
    throw new AppleAccountTokenError("Apple purchases require a trusted HTTPS API origin.");
  }

  const endpoint = new URL("/api/apple-iap/account-token", parsedOrigin.origin);
  let response: Response;
  try {
    response = await fetchImpl(endpoint.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
  } catch {
    throw new AppleAccountTokenError("Could not connect to prepare Apple purchases. Try again.");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AppleAccountTokenError("The Apple purchase service returned an invalid response.");
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body &&
      typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : "Apple purchases are temporarily unavailable.";
    throw new AppleAccountTokenError(message);
  }

  const token =
    body && typeof body === "object" && "appAccountToken" in body
      ? (body as { appAccountToken?: unknown }).appAccountToken
      : null;

  if (typeof token !== "string" || !UUID_PATTERN.test(token)) {
    throw new AppleAccountTokenError("The Apple purchase service returned an invalid account token.");
  }

  return token;
}
