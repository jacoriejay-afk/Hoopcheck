"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuthState } from "./AuthProvider";

function HoopCheckMark() {
  return (
    <svg className="hc-brand-mark" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
      <path d="M120 8 218 62 218 166 120 226 22 166 22 62Z" fill="#0d0d0d" stroke="currentColor" strokeWidth="9" strokeLinejoin="miter" />
      <circle cx="120" cy="117" r="63" fill="none" stroke="currentColor" strokeWidth="6" />
      <path d="M57 117h126M120 54c-25 26-25 100 0 126M120 54c25 26 25 100 0 126M75 72c31 18 58 61 90 90M165 72c-31 18-58 61-90 90" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="m125 140 105-78-47 76-24-6-23 27Z" fill="var(--hc-orange)" stroke="none" />
    </svg>
  );
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.8" cy="10.8" r="6.4" /><path d="m16 16 4.5 4.5" /></svg>;
}

export default function SiteHeader() {
  const pathname = usePathname();
  const { signedIn } = useAuthState();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname.startsWith("/admin") || pathname === "/dashboard") return null;

  const active = (href: string) =>
    href === "/directory"
      ? pathname === "/directory" || pathname.startsWith("/teams") || pathname.startsWith("/coaches") || pathname.startsWith("/players")
      : href === "/leagues"
        ? pathname === "/leagues" || pathname.startsWith("/leagues/")
        : href === "/reviews"
          ? pathname === "/reviews"
          : false;
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header-global hc-template-header">
      <Link href={signedIn ? "/dashboard" : "/"} className="site-header-brand" aria-label="HoopCheck home" onClick={closeMenu}>
        <HoopCheckMark />
        <span className="hc-wordmark">HOOP<span>CHECK</span></span>
      </Link>

      <button
        type="button"
        className="hc-mobile-menu-toggle"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={menuOpen}
        aria-controls="hc-primary-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span /><span /><span />
      </button>

      <nav id="hc-primary-navigation" className={menuOpen ? "hc-header-nav is-open" : "hc-header-nav"} aria-label="Primary navigation">
        <div className="hc-header-links">
          <Link href="/directory" className={active("/directory") ? "is-active" : ""} aria-current={active("/directory") ? "page" : undefined} onClick={closeMenu}>Directory</Link>
          <Link href="/leagues" className={active("/leagues") ? "is-active" : ""} aria-current={active("/leagues") ? "page" : undefined} onClick={closeMenu}>Leagues</Link>
          <Link href="/reviews" className={active("/reviews") ? "is-active" : ""} aria-current={active("/reviews") ? "page" : undefined} onClick={closeMenu}>Analytics</Link>
          <Link href="/reviews" className={active("/reviews") ? "is-active" : ""} aria-current={active("/reviews") ? "page" : undefined} onClick={closeMenu}>Ratings</Link>
        </div>
        <div className="hc-header-actions">
          <Link href="/search" className="hc-header-icon" aria-label="Search HoopCheck" onClick={closeMenu}><SearchIcon /></Link>
          <Link href={signedIn ? "/dashboard" : "/login"} className="hc-header-signin" onClick={closeMenu}>{signedIn ? "Dashboard" : "Sign In"}</Link>
        </div>
      </nav>
    </header>
  );
}
