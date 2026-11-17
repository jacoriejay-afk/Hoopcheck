import { traceFlow } from "./telemetry";
import NetInfo from "@react-native-community/netinfo";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { clearPublicCache, readCache, writeCache } from "./cache";

const Context = createContext({ offline: false, revision: 0 });
export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState({ offline: false, revision: 0 });
  useEffect(() => NetInfo.addEventListener(state => {
    const offline = state.isConnected === false || state.isInternetReachable === false;
    setNetwork(previous => ({ offline, revision: previous.offline && !offline ? previous.revision + 1 : previous.revision }));
  }), []);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") void clearPublicCache().catch(() => {});
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return <Context.Provider value={network}>{children}</Context.Provider>;
}
export const useNetwork = () => useContext(Context);
export async function requireOnline() {
  const state = await NetInfo.fetch();
  if (state.isConnected === false || state.isInternetReachable === false) throw new Error("You’re offline. Nothing was sent. Reconnect and submit again; your text stays here.");
}

// Only public directory/profile queries. Never wrap reviews or entitlement results.
export function useCachedRead() {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const read = useCallback(async <T,>(key: string, request: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<{ data: T | null; error: unknown }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const scope = session?.user.id ?? "anonymous";
    const scopedKey = `${scope}:${key}`;
    const state = await NetInfo.fetch();
    if (state.isConnected === false || state.isInternetReachable === false) {
      const cached = await readCache<T>(scopedKey);
      setSavedAt(cached?.savedAt ?? null);
      return cached ? { data: cached.data, error: null } : { data: null, error: new Error("No saved data is available. Reconnect to load this page.") };
    }
    try {
      const flow = key.includes(":profile:") ? (key.startsWith("teams:") ? "team" : key.startsWith("leagues:") ? "league" : "profile") : "directory";
      const result = await traceFlow(flow, async () => await request());
      setSavedAt(null);
      // Persist only a successful, current-session response. An empty result replaces stale data.
      const { data: current } = await supabase.auth.getSession();
      if (!result.error && current.session?.user.id === session?.user.id) await writeCache(scopedKey, result.data);
      return result;
    } catch { return { data: null, error: new Error("Could not load data. Please try again.") }; }
  }, []);
  return { read, savedAt };
}
