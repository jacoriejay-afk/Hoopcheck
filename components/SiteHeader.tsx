"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthState } from "./AuthProvider";
import { useLanguage } from "./LanguageProvider";
import { supabase } from "../lib/supabase";
import Logo from "./Logo";

function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4" /><path d="m16 16 4.5 4.5" /></svg>; }
function BellIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>; }
function UserIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5" /><path d="M4.5 21c.4-4.4 3-6.7 7.5-6.7s7.1 2.3 7.5 6.7Z" /></svg>; }

export default function SiteHeader() {
  const pathname = usePathname();
  const { signedIn, userId } = useAuthState();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountType, setAccountType] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let live = true;
    if (!userId) { setAccountType(""); setIsAdmin(false); return; }
    void Promise.all([
      supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle(),
      supabase.rpc("get_current_user_admin_role"),
    ]).then(([profile, role]) => {
      if (live) {
        setAccountType(profile.data?.account_type || "");
        setIsAdmin(role.data === "admin" || role.data === "moderator");
      }
    });
    return () => { live = false; };
  }, [userId]);

  if (pathname.startsWith("/admin")) return null;
  const closeMenu = () => setMenuOpen(false);
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const links = [
    { href: "/dashboard", label: "Home" },
    { href: "/search", label: "Search" },
    { href: "/directory", label: "Explore" },
    { href: "/teams", label: "Men’s Teams" },
    { href: "/womens", label: "Women’s Teams" },
    { href: "/coaches", label: "Coaches" },
    { href: "/leagues", label: "Leagues" },
    { href: "/players", label: "Players" },
    { href: "/reviews", label: "Reviews" },
    { href: "/live-games", label: "Live Games" },
    { href: accountType === "fan" ? "/fan-feed" : "/feed", label: "HoopFeed" },
    ...(signedIn ? [
      ...(accountType === "fan" ? [{ href: "/team-hub", label: "Team Hub" }, { href: "/fans", label: "Find Fan" }] : []),
      ...(accountType === "player" || accountType === "scout" || accountType === "agent" ? [{ href: "/connections", label: "Connections" }] : []),
      ...(accountType === "coach" ? [{ href: "/coach-placement", label: "Coach Placement" }] : []),
      { href: "/notifications", label: "Alerts" },
      { href: "/account", label: "Account" },
      ...(isAdmin ? [{ href: "/admin/directory", label: "Admin" }] : []),
    ] : [{ href: "/notifications", label: "Alerts" }]),
  ];
  const primary = [
    { href: "/dashboard", label: "Home" },
    { href: "/teams", label: "Men’s Teams" },
    { href: "/womens", label: "Women’s Teams" },
    { href: "/leagues", label: "Leagues" },
    { href: "/live-games", label: "Live Games" },
  ];
  const explore: { href: string; label: string; compact?: boolean }[] = [
    { href: "/coaches", label: "Coaches", compact: true },
    { href: "/players", label: "Players", compact: true },
    { href: "/search", label: "Search" },
    { href: "/directory", label: "Explore hub" },
    { href: "/reviews", label: "Reviews" },
    { href: accountType === "fan" ? "/fan-feed" : "/feed", label: "HoopFeed" },
    ...(signedIn && accountType === "fan" ? [{ href: "/team-hub", label: "Team Hub" }, { href: "/fans", label: "Find Fan" }] : []),
    ...(signedIn && ["player", "scout", "agent"].includes(accountType) ? [{ href: "/connections", label: "Connections" }] : []),
    ...(signedIn && accountType === "coach" ? [{ href: "/coach-placement", label: "Coach Placement" }] : []),
    ...(isAdmin ? [{ href: "/admin/directory", label: "Admin" }] : []),
  ];

  return (
    <>
      <header className="site-header-global hc-template-header hc-mobile-header">
        <Link href={signedIn ? "/dashboard" : "/"} className="site-header-brand" aria-label="HoopCheck home">
          <Logo variant="full" size={42} title="HoopCheck™" />
        </Link>
        <button type="button" className="hc-mobile-menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><span /><span /><span /></button>
        <nav className={menuOpen ? "hc-header-nav is-open" : "hc-header-nav"} aria-label="Primary navigation">
          <div className="hc-header-links">
            <div className="hc-header-mobile-links">
              {links.filter(item => item.href !== "/players" || !signedIn || (accountType !== "" && accountType !== "fan")).map(item => <Link key={item.href} href={item.href} className={active(item.href) ? "is-active" : ""} onClick={closeMenu}>{item.label}</Link>)}
            </div>
            <div className="hc-header-desktop-links">
              {links.filter(item => ["/dashboard", "/search", "/directory", "/live-games"].includes(item.href)).map(item => <Link key={item.href} href={item.href} className={active(item.href) ? "is-active" : ""}>{item.label}</Link>)}
              <details className="hc-header-more"><summary>More <span aria-hidden="true">▾</span></summary><div className="hc-header-more-panel">
                {links.filter(item => !["/dashboard", "/search", "/directory", "/live-games"].includes(item.href) && (item.href !== "/players" || !signedIn || (accountType !== "" && accountType !== "fan"))).map(item => <Link key={item.href} href={item.href} className={active(item.href) ? "is-active" : ""}>{item.label}</Link>)}
              </div></details>
            </div>
          </div>
          <div className="hc-header-actions"><Link href="/search" className="hc-header-icon" aria-label={t("search")} onClick={closeMenu}><SearchIcon /></Link>{!signedIn && <Link href="/login" className="hc-signin-button" onClick={closeMenu}>SIGN IN <span aria-hidden="true">↗</span></Link>}<Link href={signedIn ? "/account" : "/login"} className="hc-header-icon" aria-label={signedIn ? "Account" : "Sign in"} onClick={closeMenu}><UserIcon /></Link></div>
        </nav>
      </header>
      <header className="site-header-global hc-template-header hc-desktop-header">
        <Link href={signedIn ? "/dashboard" : "/"} className="site-header-brand" aria-label="HoopCheck home">
          <Logo variant="full" size={32} title="HoopCheck™" />
        </Link>
        <nav className="hc-header-nav" aria-label="Primary navigation">
          <div className="hc-header-links">
            {primary.map(item => <Link key={item.href} href={item.href} className={active(item.href) ? "is-active" : ""}>{item.label}</Link>)}
            <Link href="/coaches" className={`hc-compact-nav-link ${active("/coaches") ? "is-active" : ""}`}>Coaches</Link>
            <Link href="/players" className={`hc-compact-nav-link ${active("/players") ? "is-active" : ""}`}>Players</Link>
            <details className="hc-explore-menu">
              <summary className={explore.some(item => active(item.href)) ? "is-active" : ""}>Explore <span aria-hidden="true">⌄</span></summary>
              <div className="hc-explore-dropdown">
                {explore.map(item => <Link key={item.href} href={item.href} className={`${item.compact ? "hc-wide-only-explore" : ""} ${active(item.href) ? "is-active" : ""}`}>{item.label}</Link>)}
              </div>
            </details>
          </div>
        </nav>
        <div className="hc-header-actions">
          <Link href="/search" className="hc-header-icon" aria-label={t("search")}><SearchIcon /></Link>
          <Link href="/notifications" className="hc-header-icon" aria-label="Alerts"><BellIcon /></Link>
          {signedIn ? <Link href="/account" className="hc-header-icon hc-account-action" aria-label="Account"><UserIcon /></Link> : <Link href="/login" className="hc-signin-button">SIGN IN</Link>}
        </div>
      </header>
    </>
  );
}
