import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { supabase } from "../lib/supabase";
import { useMfaSession } from "./mfa";
import { useNetwork } from "./network";
import { readWithDeadline } from "./readDeadline";
import { requestNativeAccount, type NativeAccount } from "./accountClient";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
function useAccountRequest() {
  const [account, setAccount] = useState<NativeAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const { offline, revision } = useNetwork();
  const security = useMfaSession();
  const retry = useCallback(() => { generation.current++; setAccount(null); setRefresh(value => value + 1); }, []);
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => { if (state === "active") retry(); });
    const refreshTimer = setInterval(() => { if (AppState.currentState === "active") retry(); }, 15 * 60 * 1000);
    return () => { listener.remove(); clearInterval(refreshTimer); };
  }, [retry]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(retry);
    return () => data.subscription.unsubscribe();
  }, [retry]);
  useEffect(() => {
    let active = true;
    const current = generation.current;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 15000);
    setAccount(null); setError(""); setLoading(true);
    const load = async () => {
      try {
        if (offline) throw new Error("Offline");
        if (security.phase !== "ready") throw new Error("Finish security verification first");
        const { data, error: sessionError } = await readWithDeadline(() => supabase.auth.getSession());
        if (sessionError || !data.session || data.session.user.id !== security.owner) throw new Error("Missing session");
        const result = await requestNativeAccount(origin, data.session.access_token, controller.signal);
        if (result.user.id !== data.session.user.id) throw new Error("Account identity mismatch");
        if (active && current === generation.current) setAccount(result);
      } catch { if (active) setError(offline ? "Reconnect to verify your account and membership." : "Your account could not be verified. Try again or sign in again."); }
      finally { clearTimeout(deadline); if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; clearTimeout(deadline); controller.abort(); };
  }, [offline, revision, refresh, security.phase, security.owner]);
  return { account: offline || security.phase !== "ready" ? null : account, loading, error, retry };
}

const AccountContext = createContext<ReturnType<typeof useAccountRequest>>({ account: null, loading: true, error: "", retry: () => {} });
export function NativeAccountProvider({ children }: { children: ReactNode }) {
  const value = useAccountRequest();
  return createElement(AccountContext.Provider, { value }, children);
}
export function useNativeAccount() { return useContext(AccountContext); }
