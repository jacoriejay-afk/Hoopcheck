import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { readMfaState, type MfaState } from "../../../../lib/auth/mfa-core";
import { supabase } from "../lib/supabase";
import { recordFreshSignIn } from "./lockPolicy";
import { useNetwork } from "./network";
type Snapshot = { owner: string | null; phase: "loading" | "ready" | "challenge" | "error"; state: MfaState | null; error: string };
const initial: Snapshot = { owner: null, phase: "loading", state: null, error: "" };
const Context = createContext({ ...initial, verifiedRevision: 0, retry: () => {} });
export function MfaSessionProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(initial); const [revision, setRevision] = useState(0); const [verifiedRevision, setVerifiedRevision] = useState(0);
  const verified = useRef<MfaState | null>(null);
  const { offline } = useNetwork();
  const retry = useCallback(() => { setSnapshot({ owner: userId, phase: "loading", state: null, error: "" }); setRevision(value => value + 1); }, [userId]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep this callback synchronous: auth work runs in the effect below.
      verified.current = null;
      if (event === "MFA_CHALLENGE_VERIFIED" && session?.user.id === userId) { recordFreshSignIn(userId); setVerifiedRevision(value => value + 1); }
      retry();
    });
    return () => data.subscription.unsubscribe();
  }, [retry, userId]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => { if (state === "active") retry(); });
    return () => listener.remove();
  }, [retry]);
  useEffect(() => {
    let active = true;
    if (!userId) { setSnapshot({ owner: null, phase: "ready", state: null, error: "" }); return; }
    if (offline) {
      const known = verified.current;
      // Retain only a previously server-verified, in-memory identity during a
      // connection loss. Protected features still require online bootstrap.
      setSnapshot(known?.owner === userId && !known.required ? { owner: userId, phase: "ready", state: known, error: "" } : { owner: userId, phase: "error", state: null, error: "Reconnect to verify your security settings." });
      return;
    }
    setSnapshot({ owner: userId, phase: "loading", state: null, error: "" });
    void readMfaState(supabase, userId).then(state => { if (active) { verified.current = state; setSnapshot({ owner: userId, phase: state.required ? "challenge" : "ready", state, error: "" }); } }).catch(() => { if (active) setSnapshot({ owner: userId, phase: "error", state: null, error: "Your security settings could not be verified. Please try again." }); });
    return () => { active = false; };
  }, [userId, revision, offline]);
  const current = snapshot.owner === userId ? snapshot : { ...initial, owner: userId };
  return <Context.Provider value={{ ...current, verifiedRevision, retry }}>{children}</Context.Provider>;
}
export const useMfaSession = () => useContext(Context);
