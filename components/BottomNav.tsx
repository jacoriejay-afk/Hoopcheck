"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MotionSwoosh } from "./HoopMotion";
import { supabase } from "../lib/supabase";
import { usePathname } from "next/navigation";
import { useAuthState } from "./AuthProvider";
import { useLanguage } from "./LanguageProvider";

const items = [
  ["/", "home", "Home"],
  ["/feed", "hoopFeed", "HoopFeed"],
  ["/search", "search", "Search"],
  ["/notifications", "alerts", "Alerts"],
  ["/profile", "account", "Account"],
] as const;

function NavIcon({ label }: { label: (typeof items)[number][2] }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common}>
      {label === "Home" && <><path d="m3 10 9-7 9 7" /><path d="M5.5 9v11h13V9M9.5 20v-6h5v6" /></>}
      {label === "HoopFeed" && <><circle cx="12" cy="12" r="9" /><path d="M3.5 9h17M3.5 15h17M12 3c3 3 4.5 6 4.5 9S15 18 12 21M12 3C9 6 7.5 9 7.5 12S9 18 12 21" /></>}
      {label === "Search" && <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>}
      {label === "Alerts" && <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>}
      {label === "Account" && <><circle cx="12" cy="7.5" r="3.5" /><path d="M4.5 21c.4-4.4 3-6.7 7.5-6.7s7.1 2.3 7.5 6.7Z" /></>}
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const [swooshActive, setSwooshActive] = useState(false);
  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    const tabs = ["/", "/dashboard", "/feed", "/fan-feed", "/search", "/notifications", "/profile"];
    const isTab = (path: string) => tabs.some(tab => tab === path || (tab !== "/" && path.startsWith(tab + "/")));
    if (previous !== pathname && isTab(previous) && isTab(pathname)) {
      setSwooshActive(true);
      const timer = window.setTimeout(() => setSwooshActive(false), 460);
      return () => window.clearTimeout(timer);
    }
  }, [pathname]);
  const { signedIn, userId } = useAuthState();
  const { t } = useLanguage();
  const [accountType, setAccountType] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!userId) { setAccountType(null); return; }
    void supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle().then(({ data }) => {
      if (active) setAccountType(data?.account_type || null);
    });
    return () => { active = false; };
  }, [userId]);
  const [fanAccount, setFanAccount] = useState(false);
  useEffect(() => { let alive = true; if (!signedIn) { setFanAccount(false); return; } void supabase.auth.getUser().then(async ({ data }) => { if (!data.user) return; const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", data.user.id).maybeSingle(); if (alive) setFanAccount(profile?.account_type === "fan"); }); return () => { alive = false; }; }, [signedIn]);

  if (!signedIn || pathname.startsWith("/admin")) return null;

  return (
    <nav className="bottom-nav hc-bottom-tab-bar" aria-label="Mobile navigation">
      {items.map(([href, translationKey, label]) => {
        const destination = href === "/feed" && fanAccount ? "/fan-feed" : href;
        const active = destination === "/"
          ? pathname === "/" || pathname === "/dashboard"
          : pathname === destination || pathname.startsWith(destination + "/");
        return (
          <Link key={href} href={destination} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            <span className="bottom-nav-icon"><NavIcon label={label} /></span>
            <span className="bottom-nav-label">{translationKey === "hoopFeed" ? "HoopFeed" : t(translationKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
