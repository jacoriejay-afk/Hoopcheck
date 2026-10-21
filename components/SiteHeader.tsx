"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuthState } from "./AuthProvider";
import { useLanguage } from "./LanguageProvider";
import Logo from "./Logo";

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4" /><path d="m16 16 4.5 4.5" /></svg>;
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5" /><path d="M4.5 21c.4-4.4 3-6.7 7.5-6.7s7.1 2.3 7.5 6.7Z" /></svg>;
}

export default function SiteHeader() {
  const pathname = usePathname();
  const { signedIn } = useAuthState();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname.startsWith("/admin") || pathname === "/dashboard") return null;

  const active = (href: string) => pathname === href || (href === "/teams" && pathname.startsWith("/teams"));
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header-global hc-template-header">
      <Link href={signedIn ? "/dashboard" : "/"} className="site-header-brand" aria-label="HoopCheck home">
        <Logo variant="full" size={42} />
      </Link>

      <button type="button" className="hc-mobile-menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>

      <nav className={menuOpen ? "hc-header-nav is-open" : "hc-header-nav"} aria-label="Primary navigation">
        <div className="hc-header-links">
          <Link href="/" className={active("/") ? "is-active" : ""} onClick={closeMenu}>{t("home")}</Link>
          <Link href="/directory" className={active("/directory") ? "is-active" : ""} onClick={closeMenu}>{t("directory")}</Link>
          <Link href="/reviews" className={active("/reviews") ? "is-active" : ""} onClick={closeMenu}>{t("reviews")}</Link>
          <Link href="/notifications" className={active("/notifications") ? "is-active" : ""} onClick={closeMenu}>{t("alerts")}</Link>
        </div>
        <div className="hc-header-actions">
          <Link href="/search" className="hc-header-icon" aria-label={t("search")} onClick={closeMenu}><SearchIcon /></Link>
          {!signedIn && <Link href="/login" className="hc-signin-button" onClick={closeMenu}>{t("signIn").toUpperCase()} <span aria-hidden="true">↗</span></Link>}
          <Link href={signedIn ? "/profile" : "/login"} className="hc-header-icon" aria-label={signedIn ? t("account") : t("signIn")} onClick={closeMenu}><UserIcon /></Link>
        </div>
      </nav>
    </header>
  );
}
