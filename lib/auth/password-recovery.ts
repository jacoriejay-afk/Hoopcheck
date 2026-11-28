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

export function isRecoveryPage(path: string) {
  return path === "/reset-password" || path === appRecoveryPath;
}

// Static parser-time script, never contains a user credential in the HTML.
// Capture the initial URL before the shared browser Auth client or Next's
// hydration can consume or rewrite it. No session/local storage, logs or cookies.
export const recoveryEntryBootstrap = `(function(){var u=new URL(window.location.href);if(u.pathname!=="/reset-password"&&u.pathname!=="/recover-password")return;if(!u.search&&!u.hash)return;var entry=u.href;var key=Symbol.for("hoopcheck.recovery-entry");window[key]=function(){var value=entry;entry=null;delete window[key];return value;};window.history.replaceState(window.history.state,"",u.pathname);})();`;

export function takeInitialRecoveryUrl(): string | null {
  if (typeof window === "undefined") return null;
  const host = window as unknown as Record<symbol, unknown>;
  const key = Symbol.for("hoopcheck.recovery-entry");
  const read = host[key];
  if (typeof read !== "function") return null;
  delete host[key];
  const value: unknown = read();
  return typeof value === "string" ? value : null;
}

// The shared browser client must never auto-exchange a recovery-route PKCE
// code, even if the router briefly restores the original URL. Only the isolated
// in-memory recovery client is allowed to perform the explicitly scoped exchange.
export function guardSharedRecoveryExchange(project: string, request: typeof fetch): typeof fetch {
  const origin = new URL(project).origin;
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (typeof window !== "undefined" && isRecoveryPage(window.location.pathname) &&
        url.origin === origin && url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "pkce") {
      return new Response(JSON.stringify({ error_code: "recovery_requires_isolated_client", msg: "Use the password recovery form." }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    return request(input, init);
  };
}
