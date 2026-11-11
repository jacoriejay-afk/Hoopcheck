"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

type TabLabel = (typeof items)[number][2];

/* These icons are deliberately self-contained inline SVGs. They do not depend
   on icon fonts, external sprites, CSS masks, or runtime-fetched assets. */
function TabIcon({ label }: { label: TabLabel }) {
  const svgProps = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    focusable: false,
    "aria-hidden": true as const,
    className: "hc-lm2f-tab-svg",
  };

  switch (label) {
    case "Home":
      return (
        <svg {...svgProps}>
          <path d="m3 10 9-7 9 7" />
          <path d="M5.5 9v11h13V9M9.5 20v-6h5v6" />
        </svg>
      );
    case "HoopFeed":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3.5 9h17M3.5 15h17" />
          <path d="M12 3c3 3 4.5 6 4.5 9S15 18 12 21M12 3C9 6 7.5 9 7.5 12S9 18 12 21" />
        </svg>
      );
    case "Search":
      return (
        <svg {...svgProps}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
        </svg>
      );
    case "Alerts":
      return (
        <svg {...svgProps}>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      );
    case "Account":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="7.5" r="3.5" />
          <path d="M4.5 21c.4-4.4 3-6.7 7.5-6.7s7.1 2.3 7.5 6.7Z" />
        </svg>
      );
  }
}

export default function BottomNav() {
  const pathname = usePathname();
  const { signedIn, userId } = useAuthState();
  const { t } = useLanguage();
  const [accountType, setAccountType] = useState<string | null>(null);
  const [accountTypeLoading, setAccountTypeLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!userId) { setAccountType(null); setAccountTypeLoading(false); return; }
    setAccountTypeLoading(true);
    setAccountType(null);
    void supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle().then(({ data, error }) => {
      if (active) {
        setAccountType(error ? null : data?.account_type || null);
        setAccountTypeLoading(false);
      }
    });
    return () => { active = false; };
  }, [userId]);

  // Authentication pages should never show the signed-in mobile tab bar.\n  if (!signedIn || pathname.startsWith("/admin") || pathname === "/login" || pathname === "/signup") return null;

  return (
    <nav className="bottom-nav hc-bottom-tab-bar hc-mobile-tabbar-repair hc-lm2f-bottom-nav hc-liquid-glass-nav" aria-label="Mobile navigation">
      {items.map(([href, translationKey, label]) => {
        const destination = href === "/feed" && accountType === "fan" ? "/fan-feed" : href;
        const feedResolving = href === "/feed" && accountTypeLoading;
        const active = destination === "/"
          ? pathname === "/" || pathname === "/dashboard"
          : pathname === destination || pathname.startsWith(destination + "/");
        return (
          <Link
            key={href}
            href={destination}
            className={active ? "hc-lm2f-tab hc-smooth-press active" : "hc-lm2f-tab hc-smooth-press"}
            aria-current={active ? "page" : undefined}
            aria-disabled={feedResolving ? true : undefined}
            onClick={feedResolving ? (event) => event.preventDefault() : undefined}
          >
            <span className="hc-lm2f-tab-icon"><TabIcon label={label} /></span>
            <span className="hc-lm2f-tab-label">{translationKey === "hoopFeed" ? (accountType === "fan" ? "FAN HQ" : "HoopFeed") : t(translationKey)}</span>
            {active && <span className="hc-lm2f-active-indicator" aria-hidden="true" />}
          </Link>
        );
      })}
    </nav>
  );
}
