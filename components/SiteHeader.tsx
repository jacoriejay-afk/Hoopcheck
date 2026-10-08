"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthState } from "./AuthProvider";

export default function SiteHeader() {
  const pathname = usePathname();
  const { signedIn } = useAuthState();

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="site-header-global">
      <Link href={signedIn ? "/dashboard" : "/"} className="site-header-brand">HOOP<span>CHECK</span></Link>
      <nav aria-label="Primary navigation">
        {signedIn ? (
          <>
            <Link href="/search">Search</Link>
            <Link href="/teams">Teams</Link>
            <Link href="/players">Players</Link>
            <Link href="/profile">Profile</Link>
          </>
        ) : (
          <>
            <Link href="/login" className="site-header-signin">Sign In</Link>
            <Link href="/signup" className="site-header-signup">Sign Up</Link>
          </>
        )}
      </nav>
    </header>
  );
}
