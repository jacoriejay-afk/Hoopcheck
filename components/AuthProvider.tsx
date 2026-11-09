"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getCachedSession, supabase } from "../lib/supabase";

type AuthState = { userId: string | null; signedIn: boolean; accountType: string | null; roleLoading: boolean; isAdmin: boolean };
const AuthContext = createContext<AuthState>({ userId: null, signedIn: false, accountType: null, roleLoading: false, isAdmin: false });

export function useAuthState() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<{ userId: string; accountType: string | null; isAdmin: boolean } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void Promise.allSettled([
      supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle(),
      supabase.rpc("get_current_user_admin_role"),
    ]).then(([profile, role]) => {
      if (!active) return;
      const accountType = profile.status === "fulfilled" && !profile.value.error ? profile.value.data?.account_type ?? null : null;
      const adminRole = role.status === "fulfilled" && !role.value.error ? role.value.data : null;
      setIdentity({ userId, accountType, isAdmin: adminRole === "admin" || adminRole === "moderator" });
    });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    let authEventSeen = false;
    void getCachedSession().then(({ data }) => {
      // Do not overwrite a newer sign-in/sign-out event with an older session read.
      if (mounted && !authEventSeen) setUserId(data.session?.user?.id ?? null);
    }).catch((error) => {
      console.error("Unable to restore authentication session:", error);
      // Keep the last known auth state until a subsequent auth event.
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventSeen = true;
      if (mounted) {
        setUserId(session?.user?.id ?? null);
        if (!session?.user) setIdentity(null);
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const currentIdentity = identity?.userId === userId ? identity : null;
  return <AuthContext.Provider value={{ userId, signedIn: Boolean(userId), accountType: currentIdentity?.accountType ?? null, roleLoading: Boolean(userId) && !currentIdentity, isAdmin: currentIdentity?.isAdmin ?? false }}>{children}</AuthContext.Provider>;
}
