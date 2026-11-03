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
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const primary = [
    { href: "/dashboard", label: "Home" },
    { href: "/teams", label: "Men’s Teams" },
    { href: "/womens", label: "Women’s Teams" },
    { href: "/leagues", label: "Leagues" },
    { href: "/live-games", label: "Live Games" },
  ];
  const explore = [
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
    <header className="site-header-global hc-template-header hc-desktop-header">
      <Link href={signedIn ? "/dashboard" : "/"} className="site-header-brand" aria-label="HoopCheck home">
        <Logo variant="full" size={32} />
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
  );
}
