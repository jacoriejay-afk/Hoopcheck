"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
};
const AuthContext = createContext<AuthState>({
  userId: null, signedIn: false, ready: false,
  membershipTier: "free", membershipActive: false, membershipReady: false,
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
    }).catch(() => { if (mounted) setReady(true); });
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

  useEffect(() => {
    let mounted = true;
    setMembershipTier("free");
    setMembershipActive(false);
    if (!userId) { setMembershipReady(true); return () => { mounted = false; }; }
    setMembershipReady(false);
    void supabase.from("subscriptions")
      .select("plan,status,access_status,current_period_end")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        const active = hasActiveMembershipAtLeast(data, "pro");
        setMembershipActive(active);
        setMembershipTier(active && (data?.plan === "premium" || data?.plan === "pro") ? data.plan : "free");
        setMembershipReady(true);
      }).catch(() => { if (mounted) setMembershipReady(true); });
    return () => { mounted = false; };
  }, [userId]);

  return <AuthContext.Provider value={{
    userId, signedIn: Boolean(userId), ready,
    membershipTier, membershipActive, membershipReady,
  }}>{children}</AuthContext.Provider>;
}
