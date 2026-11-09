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
  if (!sessionPromise) {
    const pending = supabase.auth.getSession();
    sessionPromise = pending;
    // A failed session read must not poison subsequent auth checks.
    void pending.then(({ error }) => {
      if (error && sessionPromise === pending) sessionPromise = null;
    }, () => {
      if (sessionPromise === pending) sessionPromise = null;
    });
  }
  return sessionPromise;
}
