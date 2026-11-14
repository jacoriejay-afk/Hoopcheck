import { createBrowserClient, stringFromBase64URL } from "@supabase/ssr";

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

export function hasRecoveryCodeVerifier() {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token-code-verifier`;
  const cookie = document.cookie.split("; ").find(value => value.startsWith(`${cookieName}=`));
  if (!cookie) return false;
  try {
    const encoded = decodeURIComponent(cookie.slice(cookieName.length + 1));
    const value = encoded.startsWith("base64-") ? stringFromBase64URL(encoded.slice(7)) : encoded;
    // Supabase Auth 2.76.1 stores this suffix on PKCE password recovery requests.
    const verifier: unknown = JSON.parse(value);
    return typeof verifier === "string" && verifier.endsWith("/PASSWORD_RECOVERY");
  } catch {
    return false;
  }
}

// Supabase may exchange the code before the reset page mounts.
let initialRecoveryCode = typeof window !== "undefined" &&
  window.location.pathname === "/reset-password" &&
  new URLSearchParams(window.location.search).has("code") &&
  hasRecoveryCodeVerifier();

export function consumeInitialRecoveryCode() {
  const recovery = initialRecoveryCode;
  initialRecoveryCode = false;
  return recovery;
}

export const supabase = createBrowserClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

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
