"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getCachedSession, supabase } from "../lib/supabase";

type AuthState = { userId: string | null; signedIn: boolean };
const AuthContext = createContext<AuthState>({ userId: null, signedIn: false });

export function useAuthState() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);

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
      if (mounted) setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ userId, signedIn: Boolean(userId) }}>{children}</AuthContext.Provider>;
}
