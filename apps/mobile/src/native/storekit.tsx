import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import nativeStoreKit from "../../modules/hoopcheck-storekit";
import { supabase } from "../lib/supabase";
import { useMfaSession } from "./mfa";
import { useNativeAccount } from "./useNativeAccount";
import { useNetwork } from "./network";
import { createStoreKitClient, storeRequest } from "./storekitClient";
const Context = createContext<ReturnType<typeof createStoreKitClient> | null>(null);
type Snapshot = { security: ReturnType<typeof useMfaSession>; account: ReturnType<typeof useNativeAccount>; network: ReturnType<typeof useNetwork> };
function createRuntime(initial: Snapshot) {
  let snapshot = initial, refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const client = createStoreKitClient({
    native: Platform.OS === "ios" ? nativeStoreKit : null,
    purchasesAvailable: Platform.OS === "ios" && Number.parseFloat(String(Platform.Version)) >= 16,
    session: async () => {
      const { data, error } = await supabase.auth.getSession();
      return !error && data.session ? { id: data.session.user.id, token: data.session.access_token } : null;
    },
    request: storeRequest(process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online"),
    available: () => !snapshot.network.offline && snapshot.security.phase === "ready" && AppState.currentState === "active",
    onSynced: () => {
      // Multiple receipts from one restore cause one account refresh.
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => snapshot.account.retry(), 200);
    },
  });
  return { client, update(next: Snapshot) {
    snapshot = next;
    client.setOwner(next.security.phase === "ready" ? next.security.owner : null);
  }, dispose() { clearTimeout(refreshTimer); client.setOwner(null); } };
}
export function StoreKitProvider({ children }: { children: ReactNode }) {
  const security = useMfaSession(), account = useNativeAccount(), network = useNetwork();
  const [runtime] = useState(() => createRuntime({ security, account, network }));
  const { client } = runtime;
  // Commit-time invalidation runs before asynchronous purchase callbacks resume.
  useLayoutEffect(() => { runtime.update({ security, account, network }); }, [runtime, security, account, network]);
  useEffect(() => {
    // Keep Auth's callback synchronous. Invalidate pending receipts immediately,
    // before React commits the next account/security snapshot.
    const { data } = supabase.auth.onAuthStateChange(() => client.setOwner(null));
    const listener = Platform.OS === "ios" ? nativeStoreKit?.addListener("onTransaction", value => { void client.receive(value).catch(() => {}); }) : null;
    const foreground = AppState.addEventListener("change", state => { if (state === "active") void client.scan().catch(() => {}); });
    return () => { data.subscription.unsubscribe(); listener?.remove(); foreground.remove(); runtime.dispose(); };
  }, [client, runtime]);
  const owner = security.phase === "ready" ? security.owner : null;
  useEffect(() => { if (owner && !network.offline) void client.scan().catch(() => {}); }, [client, owner, network.offline]);
  return <Context.Provider value={client}>{children}</Context.Provider>;
}
export function useStoreKit() {
  const client = useContext(Context);
  if (!client) throw Error("Membership provider is unavailable.");
  return client;
}
