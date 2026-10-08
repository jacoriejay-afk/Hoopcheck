"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function MobileAuth() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) =>
      setSignedIn(Boolean(session))
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!signedIn) return null;

  return (
    <Link href="/dashboard" className="mobile-auth-global">
      Dashboard
    </Link>
  );
}
