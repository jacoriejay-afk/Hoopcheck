"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function SiteHeader() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSignedIn(Boolean(data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSignedIn(Boolean(session));
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="site-header-global">
      <Link href={signedIn ? "/dashboard" : "/"} className="site-header-brand">HOOP<span>CHECK</span></Link>
      <nav aria-label="Primary navigation">
        <Link href="/search">Search</Link>
        <Link href="/teams">Teams</Link>
        <Link href="/players">Players</Link>
        {signedIn ? <Link href="/profile">Profile</Link> : <Link href="/login" className="site-header-signin">Sign In</Link>}
        {!signedIn && <Link href="/signup" className="site-header-signup">Sign Up</Link>}
      </nav>
    </header>
  );
}
