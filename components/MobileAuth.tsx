"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function MobileAuth() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    if (!signedIn) return null;

  return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <Link href={signedIn ? "/dashboard" : "/login"} className="mobile-auth-global">
      {signedIn ? "Dashboard" : "Sign In"}
    </Link>
  );
}
