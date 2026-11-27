import { createClient, processLock } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "../supabase";
import { bindAuthIntents, createAuthIntents, guardAuthResponses } from "./auth-intents";

export function createBrowserRecoveryClient(verifier?: string) {
  const storageKey = `hoopcheck-browser-recovery-${crypto.randomUUID()}`;
  const values = new Map<string, string>();
  if (verifier) values.set(`${storageKey}-code-verifier`, JSON.stringify(verifier));
  const intents = createAuthIntents();
  const client = createClient(supabaseUrl, supabaseKey, {
    global: { fetch: guardAuthResponses(supabaseUrl, intents) },
    auth: {
      storageKey,
      storage: {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); },
        removeItem: key => { values.delete(key); },
      },
      // Retain the recovery session only in this screen's memory. The shared
      // sign-in and MFA providers must never receive its auth events or cookies.
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
      lock: processLock,
    },
  });
  bindAuthIntents(client.auth, intents);
  return client;
}
