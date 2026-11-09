"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCachedSession, supabase } from "../lib/supabase";
import { hasActiveMembershipAtLeast } from "../lib/membership-tier";

type MembershipTier = "free" | "pro" | "premium";
type AuthState = {
  userId: string | null;
  signedIn: boolean;
  ready: boolean;
  membershipTier: MembershipTier;
  membershipActive: boolean;
  membershipReady: boolean;
  membershipError: boolean;
  refreshMembership: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  userId: null,
  signedIn: false,
  ready: false,
  membershipTier: "free",
  membershipActive: false,
  membershipReady: false,
  membershipError: false,
  refreshMembership: async () => {},
});

export function useAuthState() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [membershipTier, setMembershipTier] = useState<MembershipTier>("free");
  const [membershipActive, setMembershipActive] = useState(false);
  const [membershipReady, setMembershipReady] = useState(false);
  const [membershipError, setMembershipError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let authEventSeen = false;
    void getCachedSession().then(({ data }) => {
      if (mounted && !authEventSeen) {
        setUserId(data.session?.user?.id ?? null);
        setReady(true);
      }
    }).catch((error) => {
      console.error("Unable to restore authentication session:", error);
      if (mounted && !authEventSeen) setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventSeen = true;
      if (mounted) {
        setUserId(session?.user?.id ?? null);
        setReady(true);
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const refreshMembership = useCallback(async () => {
    if (!userId) {
      setMembershipTier("free");
      setMembershipActive(false);
      setMembershipError(false);
      setMembershipReady(true);
      return;
    }
    setMembershipReady(false);
    setMembershipError(false);
    try {
      const { data, error } = await supabase.from("subscriptions")
        .select("plan,status,access_status,current_period_end")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      const active = hasActiveMembershipAtLeast(data, "pro");
      setMembershipActive(active);
      setMembershipTier(active && (data?.plan === "premium" || data?.plan === "pro") ? data.plan : "free");
    } catch (error) {
      console.error("Unable to load membership status:", error);
      setMembershipActive(false);
      setMembershipTier("free");
      setMembershipError(true);
    } finally {
      setMembershipReady(true);
    }
  }, [userId]);

  useEffect(() => {
    void refreshMembership();
  }, [refreshMembership]);

  return (
    <AuthContext.Provider value={{
      userId,
      signedIn: Boolean(userId),
      ready,
      membershipTier,
      membershipActive,
      membershipReady,
      membershipError,
      refreshMembership,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
