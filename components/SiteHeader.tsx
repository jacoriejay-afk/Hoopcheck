"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuthState } from "./AuthProvider";
import Logo from "./Logo";

function HoopCheckMark() {
  return (
    <svg className="hc-brand-mark" viewBox="0 0 240 240" aria-hidden="true">
      <path d="M120 8 218 62 218 166 120 226 22 166 22 62Z" fill="var(--hc-paper-strong)" stroke="currentColor" strokeWidth="9" strokeLinejoin="miter" />
      <circle cx="120" cy="117" r="63" fill="none" stroke="currentColor" strokeWidth="6" />
      <path d="M57 117h126M120 54c-25 26-25 100 0 126M120 54c25 26 25 100 0 126M75 72c31 18 58 61 90 90M165 72c-31 18-58 61-90 90" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="m125 140 105-78-47 76-24-6-23 27Z" fill="var(--hc-orange)" />
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
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header-global hc-template-header">
      <Link href={signedIn ? "/dashboard" : "/"} className="site-header-brand" aria-label="HoopCheck home">
        <HoopCheckMark />
        <span className="hc-wordmark">HOOP<span>CHECK</span></span>
      </Link>

      <button type="button" className="hc-mobile-menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>

      <nav className={menuOpen ? "hc-header-nav is-open" : "hc-header-nav"} aria-label="Primary navigation">
        <div className="hc-header-links">
          <Link href="/" className={active("/") ? "is-active" : ""} onClick={closeMenu}>Home</Link>
          <Link href="/directory" className={active("/directory") ? "is-active" : ""} onClick={closeMenu}>Directory</Link>
          <Link href="/reviews" className={active("/reviews") ? "is-active" : ""} onClick={closeMenu}>Reviews</Link>
          <Link href="/notifications" className={active("/notifications") ? "is-active" : ""} onClick={closeMenu}>Alerts</Link>
        </div>
        <div className="hc-header-actions">
          <Link href="/search" className="hc-header-icon" aria-label="Search" onClick={closeMenu}><SearchIcon /></Link>
          {!signedIn && <Link href="/login" className="hc-signin-button" onClick={closeMenu}>SIGN IN <span aria-hidden="true">↗</span></Link>}
          <Link href={signedIn ? "/profile" : "/login"} className="hc-header-icon" aria-label={signedIn ? "Profile" : "Sign in"} onClick={closeMenu}><UserIcon /></Link>
        </div>
      </nav>
    </header>
  );
}
