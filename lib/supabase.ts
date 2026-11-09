import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

export const supabase = createBrowserClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

let sessionPromise: ReturnType<typeof supabase.auth.getSession> | null = null;
let sessionPromiseStartedAt = 0;
const SESSION_CACHE_MAX_AGE_MS = 12000;
let sessionListenerStarted = false;

function startSessionCache() {
  if (sessionListenerStarted || typeof window === "undefined") return;
  sessionListenerStarted = true;
  supabase.auth.onAuthStateChange(() => {
    sessionPromise = null;
  });
}

export function getCachedSession() {
  startSessionCache();
  // A stalled read must not poison the dashboard's subsequent Retry action.
  if (sessionPromise && Date.now() - sessionPromiseStartedAt >= SESSION_CACHE_MAX_AGE_MS) {
    sessionPromise = null;
  }
  if (!sessionPromise) {
    const pending = supabase.auth.getSession();
    sessionPromise = pending;
    sessionPromiseStartedAt = Date.now();
    // A failed session read must not poison subsequent auth checks.
    void pending.then(({ error }) => {
      if (error && sessionPromise === pending) sessionPromise = null;
    }, () => {
      if (sessionPromise === pending) sessionPromise = null;
    });
  }
  return sessionPromise;
}
