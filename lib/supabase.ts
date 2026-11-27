import { createAuthIntents, browserAuthIntentStore, browserAuthActionLock, guardAuthResponses, bindAuthIntents } from "./auth/auth-intents";
import { createBrowserClient, stringFromBase64URL } from "@supabase/ssr";
import { appRecoveryPath, recoveryLink } from "./auth/password-recovery";

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

export function takeRecoveryCodeVerifier() {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token-code-verifier`;
  const cookie = document.cookie.split("; ").find(value => value.startsWith(`${cookieName}=`));
  if (!cookie) return null;
  try {
    const encoded = decodeURIComponent(cookie.slice(cookieName.length + 1));
    const value = encoded.startsWith("base64-") ? stringFromBase64URL(encoded.slice(7)) : encoded;
    // Supabase Auth 2.76.1 stores this suffix on PKCE password recovery requests.
    const verifier: unknown = JSON.parse(value);
    if (typeof verifier !== "string" || !verifier.endsWith("/PASSWORD_RECOVERY")) return null;
    document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
    return verifier;
  } catch {
    return null;
  }
}

function captureRecoveryEntry() {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  if (!["/reset-password", appRecoveryPath].includes(url.pathname) || (!url.search && !url.hash)) return null;
  const link = recoveryLink(url.searchParams, new URLSearchParams(url.hash.slice(1)));
  // The SSR client always detects Auth credentials in the browser URL. Own the
  // recovery exchange explicitly and keep its credentials out of browser history.
  window.history.replaceState(window.history.state, "", url.pathname);
  // Claim the legacy recovery verifier before the shared Auth client initializes.
  // Do not consume OAuth/signup verifiers or credentials from the native fallback path.
  const verifier = url.pathname === "/reset-password" && link && "code" in link && link.code ? takeRecoveryCodeVerifier() : null;
  return { path: url.pathname, link, verifier };
}

let recoveryEntry = captureRecoveryEntry();
export function takeRecoveryEntry(path: string) {
  const entry = recoveryEntry;
  recoveryEntry = null;
  return entry?.path === path ? entry : null;
}

const authIntents = createAuthIntents(browserAuthIntentStore(supabaseUrl));
export const supabase = createBrowserClient(supabaseUrl, supabaseKey, {
  global: { fetch: guardAuthResponses(supabaseUrl, authIntents) },
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

bindAuthIntents(supabase.auth, authIntents, browserAuthActionLock(supabaseUrl));

let sessionPromise: ReturnType<typeof supabase.auth.getSession> | null = null;
let sessionListenerStarted = false;
let sessionRetryAt = 0;
const STALLED_SESSION_MS = 12_000;

function startSessionCache() {
  if (sessionListenerStarted || typeof window === "undefined") return;
  sessionListenerStarted = true;
  supabase.auth.onAuthStateChange(() => {
    sessionPromise = null;
  });
}

export function getCachedSession() {
  startSessionCache();
  if (!sessionPromise || Date.now() >= sessionRetryAt) {
    const pending = supabase.auth.getSession();
    sessionPromise = pending;
    sessionRetryAt = Date.now() + STALLED_SESSION_MS;
    // A failed session read must not poison subsequent auth checks.
    void pending.then(({ error }) => {
      if (sessionPromise !== pending) return;
      if (error) sessionPromise = null;
      else sessionRetryAt = Infinity;
    }, () => {
      if (sessionPromise === pending) sessionPromise = null;
    });
  }
  return sessionPromise;
}
