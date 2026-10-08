import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "hoopcheck-auth",
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
  if (!sessionPromise) sessionPromise = supabase.auth.getSession();
  return sessionPromise;
}
