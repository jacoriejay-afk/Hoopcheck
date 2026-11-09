"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuthState } from "./AuthProvider";
import { useLanguage } from "./LanguageProvider";
import { getRoleNavigation } from "../lib/navigation";
import Logo from "./Logo";

function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4" /><path d="m16 16 4.5 4.5" /></svg>; }
function UserIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5" /><path d="M4.5 21c.4-4.4 3-6.7 7.5-6.7s7.1 2.3 7.5 6.7Z" /></svg>; }

export default function SiteHeader() {
  const pathname = usePathname();
  const { signedIn, accountType, isAdmin } = useAuthState();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => {
    setMenuOpen(false);
    if (moreRef.current) moreRef.current.open = false;
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!menuOpen && !moreRef.current?.open) return;
      if (moreRef.current?.open) {
        moreRef.current.open = false;
        moreRef.current.querySelector("summary")?.focus();
      }
      setMenuOpen(false);
      if (window.matchMedia("(max-width: 700px)").matches) toggleRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setMenuOpen(false);
        if (moreRef.current) moreRef.current.open = false;
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [menuOpen]);
  if (pathname.startsWith("/admin")) return null;
  const active = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  const { workspace: roleHome, feed, live, tools } = getRoleNavigation(accountType, signedIn);
  const links = [roleHome, { href: "/search", label: "Search" }, { href: "/directory", label: "Explore" },
    { href: "/teams", label: "Men’s Teams" }, { href: "/womens", label: "Women’s Teams" },
    { href: "/coaches", label: "Coaches" }, { href: "/leagues", label: "Leagues" },
    ...(accountType !== "fan" && (!signedIn || accountType) ? [{ href: "/players", label: "Players" }] : []),
    { href: "/reviews", label: "Reviews" }, ...(live ? [live] : []), ...(feed ? [feed] : []), ...tools,
    { href: "/membership", label: "Membership" },
    ...(signedIn ? [{ href: "/notifications", label: "Alerts" }, { href: "/account", label: "Account" }, { href: "/settings", label: "Settings" }, { href: "/privacy-center", label: "Privacy Center" }, ...(isAdmin ? [{ href: "/admin/directory", label: "Admin" }] : [])] : []),
    { href: "/support", label: "Help & Support" }, { href: "/about", label: "About" },
    { href: "/founder", label: "Founder" }, { href: "/company", label: "Company" }, { href: "/partners", label: "Partnerships" }];
  return <header ref={headerRef} className="site-header-global hc-template-header">
    <Link href={roleHome.href} onClick={closeMenu} className="site-header-brand" aria-label="HoopCheck home"><Logo variant="full" size={42} title="HoopCheck™"/></Link>
    <button ref={toggleRef} type="button" aria-controls="hc-primary-navigation" className="hc-mobile-menu-toggle" aria-label={menuOpen?"Close menu":"Open menu"} aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><span/><span/><span/></button>
    <nav id="hc-primary-navigation" className={menuOpen?"hc-header-nav is-open":"hc-header-nav"} aria-label="Primary navigation">
      <div className="hc-header-links">
        <div className="hc-header-mobile-links">{links.map(item=><Link key={item.href} href={item.href} aria-current={active(item.href)?"page":undefined} className={active(item.href)?"is-active":""} onClick={closeMenu}>{item.label}</Link>)}</div>
        <div className="hc-header-desktop-links">
          {links.filter(item=>[roleHome.href,"/search","/directory","/live-games","/fan-live"].includes(item.href)).map(item=><Link key={item.href} href={item.href} aria-current={active(item.href)?"page":undefined} className={active(item.href)?"is-active":""} onClick={closeMenu}>{item.label}</Link>)}
          <details ref={moreRef} className="hc-header-more"><summary>More <span aria-hidden="true">▾</span></summary><div className="hc-header-more-panel">
            {links.filter(item=>![roleHome.href,"/search","/directory","/live-games","/fan-live"].includes(item.href)).map(item=><Link key={item.href} href={item.href} aria-current={active(item.href)?"page":undefined} className={active(item.href)?"is-active":""} onClick={closeMenu}>{item.label}</Link>)}
          </div></details>
        </div>
      </div>
      <div className="hc-header-actions"><Link href="/search" className="hc-header-icon" aria-label={t("search")} onClick={closeMenu}><SearchIcon/></Link>{!signedIn&&<Link href="/login" className="hc-signin-button" onClick={closeMenu}>SIGN IN <span aria-hidden="true">↗</span></Link>}<Link href={signedIn?"/account":"/login"} className="hc-header-icon" aria-label={signedIn?"Account":"Sign in"} onClick={closeMenu}><UserIcon/></Link></div>
    </nav>
  </header>;
}
