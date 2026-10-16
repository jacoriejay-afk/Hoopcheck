"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuthState } from "./AuthProvider";

function HoopCheckMark() {
  return (
    <svg className="hc-brand-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 2 43 13v22L24 46 5 35V13Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M11 24h26M24 11c-7 7-7 19 0 26M24 11c7 7 7 19 0 26M14.5 15.5c6 4 13 13 19 17M33.5 15.5c-6 4-13 13-19 17" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m29 5 5 8-7-1" fill="none" stroke="var(--hc-orange)" strokeWidth="3" strokeLinejoin="miter" />
    </svg>
  );
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4" /><path d="m16 16 4.5 4.5" /></svg>;
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5" /><path d="M4.5 21c.4-4.4 3-6.7 7.5-6.7s7.1 2.3 7.5 6.7Z" /></svg>;
}

export default function SiteHeader() {
  const pathname = usePathname();
  const { signedIn } = useAuthState();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname.startsWith("/admin") || pathname === "/dashboard") return null;

  const active = (href: string) => pathname === href || (href === "/teams" && pathname.startsWith("/teams"));
  return (
    <header className="site-header-global hc-template-header">
      <Link href={signedIn ? "/dashboard" : "/"} className="site-header-brand" aria-label="HoopCheck home">
        <HoopCheckMark />
        <span className="hc-wordmark">HOOP<span>CHECK</span></span>
      </Link>
      <button type="button" className="hc-mobile-menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>
      <nav className={menuOpen ? "hc-header-nav is-open" : "hc-header-nav"} aria-label="Primary navigation">
        <Link href="/" className={active("/") ? "is-active" : ""} onClick={() => setMenuOpen(false)}>Home</Link>
        <Link href="/teams" className={active("/teams") ? "is-active" : ""} onClick={() => setMenuOpen(false)}>Directory</Link>
        <Link href="/search" className={active("/search") ? "is-active" : ""} onClick={() => setMenuOpen(false)}>Reviews</Link>
        <Link href="/notifications" className={active("/notifications") ? "is-active" : ""} onClick={() => setMenuOpen(false)}>Alerts</Link>
        <Link href="/search" className="hc-header-icon" aria-label="Search" onClick={() => setMenuOpen(false)}><SearchIcon /></Link>
        <Link href={signedIn ? "/profile" : "/login"} className="hc-header-icon" aria-label={signedIn ? "Profile" : "Sign in"} onClick={() => setMenuOpen(false)}><UserIcon /></Link>
      </nav>
    </header>
  );
}
