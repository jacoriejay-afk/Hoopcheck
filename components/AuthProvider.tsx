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
    getCachedSession().then(({ data }) => {
      if (mounted) setUserId(data.session?.user?.id ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ userId, signedIn: Boolean(userId) }}>{children}</AuthContext.Provider>;
}
