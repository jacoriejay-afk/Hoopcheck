import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode, type SetStateAction } from "react";
import { supabase } from "../lib/supabase";
import { createDraftStore } from "./draftStore";
const Context = createContext<ReturnType<typeof createDraftStore> | null>(null);
export function NativeDraftProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createDraftStore(), []);
  useEffect(() => {
    // Session identity only partitions drafts; this never grants feature access.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => store.switchUser(session?.user.id ?? null));
    return () => { data.subscription.unsubscribe(); store.switchUser(null); };
  }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useNativeDraft(key: string, userId: string | undefined) {
  const store = useContext(Context);
  if (!store) throw new Error("Native draft provider is missing");
  const read = useCallback(() => store.read(userId, key), [store, userId, key]);
  const value = useSyncExternalStore(store.subscribe, read, () => "");
  const set = useCallback((next: SetStateAction<string>) => { store.write(userId, key, typeof next === "function" ? next(store.read(userId, key)) : next); }, [store, userId, key]);
  return [value, set] as const;
}
