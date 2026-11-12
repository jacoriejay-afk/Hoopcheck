import { createBrowserClient } from "@supabase/ssr";

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

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
