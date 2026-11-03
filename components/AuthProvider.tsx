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
  refreshMembership: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  userId: null,
  signedIn: false,
  ready: false,
  membershipTier: "free",
  membershipActive: false,
  membershipReady: false,
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

  useEffect(() => {
    let mounted = true;
    getCachedSession().then(({ data }) => {
      if (mounted) {
        setUserId(data.session?.user?.id ?? null);
        setReady(true);
      }
    }).catch(() => {
      if (mounted) setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
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
      setMembershipReady(true);
      return;
    }
    setMembershipReady(false);
    try {
      const { data, error } = await supabase.from("subscriptions")
        .select("plan,status,access_status,current_period_end")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      const active = hasActiveMembershipAtLeast(data, "pro");
      setMembershipActive(active);
      setMembershipTier(active && (data?.plan === "premium" || data?.plan === "pro") ? data.plan : "free");
    } catch {
      setMembershipActive(false);
      setMembershipTier("free");
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
      refreshMembership,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
