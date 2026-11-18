"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthState } from "./AuthProvider";

const items = [
  ["/dashboard", "Home"],
  ["/teams", "Teams"],
  ["/leagues", "Leagues"],
  ["/players", "Players"],
  ["/settings", "Settings"],
] as const;

type TabLabel = (typeof items)[number][1];

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
    case "Home": return <svg {...svgProps}><path d="m3 10 9-7 9 7" /><path d="M5.5 9v11h13V9M9.5 20v-6h5v6" /></svg>;
    case "Teams": return <svg {...svgProps}><circle cx="12" cy="12" r="9"/><path d="M12 3c-3 4-3 14 0 18M12 3c3 4 3 14 0 18M3 12h18"/></svg>;
    case "Leagues": return <svg {...svgProps}><path d="M8 4h8v7a4 4 0 0 1-8 0V4ZM8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 15v4m-4 2h8m-8-2h8"/></svg>;
    case "Players": return <svg {...svgProps}><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v1"/></svg>;
    case "Settings": return <svg {...svgProps}><circle cx="12" cy="12" r="3"/><path d="M10 2h4l.7 2.4 2 1.2 2.4-.6 2 3.5-1.7 1.8v2.4l1.7 1.8-2 3.5-2.4-.6-2 1.2L14 22h-4l-.7-2.4-2-1.2-2.4.6-2-3.5 1.7-1.8v-2.4L2.9 9.5l2-3.5 2.4.6 2-1.2L10 2Z"/></svg>;
  }
}

export default function BottomNav() {
  const pathname = usePathname();
  const { signedIn } = useAuthState();
  if (!signedIn || pathname.startsWith("/admin")) return null;

  return (
    <nav className="bottom-nav hc-bottom-tab-bar hc-mobile-tabbar-repair hc-lm2f-bottom-nav hc-liquid-glass-nav" aria-label="Mobile navigation">
      {items.map(([href, label]) => {
        const active = pathname === href || pathname.startsWith(href + "/")
          || (href === "/dashboard" && pathname === "/");
        return (
          <Link
            key={href}
            href={href}
            className={active ? "hc-lm2f-tab hc-smooth-press active" : "hc-lm2f-tab hc-smooth-press"}
            aria-current={active ? "page" : undefined}
          >
            <span className="hc-lm2f-tab-icon"><TabIcon label={label} /></span>
            <span className="hc-lm2f-tab-label">{label}</span>
            {active && <span className="hc-lm2f-active-indicator" aria-hidden="true" />}
          </Link>
        );
      })}
    </nav>
  );
}
