import { createBrowserClient } from "@supabase/ssr";

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

// The auth client may remove callback parameters before the reset page mounts.
export const initialRecoveryLink = (() => {
  if (typeof window === "undefined" || window.location.pathname !== "/reset-password") return null;
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if ([query, fragment].some(params => ["error", "error_code", "error_description"].some(key => params.has(key)))) {
    return null;
  }
  if (query.has("code")) return "pkce";
  if (fragment.get("type") === "recovery" && fragment.has("access_token") && fragment.has("refresh_token")) {
    return "implicit";
  }
  return null;
})();

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
