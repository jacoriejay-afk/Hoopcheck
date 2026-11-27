export const appRecoveryPath = "/recover-password";
export const recoveryRequestMessage = "If there’s an account for that email, check your inbox and spam folder for a HoopCheck reset link.";

const keyPattern = /^[A-Za-z0-9_-]{1,2048}$/;
const errorFields = ["error", "error_code", "error_description"];

export function recoveryLink(search: URLSearchParams, fragment: URLSearchParams) {
  const codes = search.getAll("code");
  const tokens = search.getAll("token_hash");
  const types = search.getAll("type");
  const hasError = errorFields.some(field => search.has(field) || fragment.has(field));
  const hasFragmentCredentials = ["code", "token_hash", "access_token", "refresh_token"].some(field => fragment.has(field));
  if (hasError || hasFragmentCredentials || codes.length > 1 || tokens.length > 1 || types.length > 1) return null;
  if (!codes.length && tokens.length === 1 && types[0] === "recovery" && keyPattern.test(tokens[0])) {
    return { token: tokens[0] };
  }
  if (!tokens.length && codes.length === 1 && (!types.length || types[0] === "recovery") && keyPattern.test(codes[0])) {
    return { code: codes[0] };
  }
  return null;
}

export function nativeRecoveryRedirect(origin: string) {
  const url = new URL(appRecoveryPath, origin);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("Password recovery requires an HTTPS site.");
  }
  if (url.username || url.password) throw new Error("Invalid recovery site.");
  return url.href;
}

let nextRequestAt = 0;

export async function requestRecoveryEmail(send: () => Promise<unknown>) {
  if (Date.now() < nextRequestAt) return false;
  // Start the cooldown before the request and keep it on every outcome. The
  // provider's server-side limits also apply across app launches and devices.
  nextRequestAt = Date.now() + 60_000;
  try {
    await send();
  } catch {
    // Account-specific errors must produce the same response as a valid request.
  }
  return true;
}
