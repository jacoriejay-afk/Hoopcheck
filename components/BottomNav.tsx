"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthState } from "./AuthProvider";

const items = [
  ["/", "Home"],
  ["/feed", "HoopFeed"],
  ["/search", "Search"],
  ["/notifications", "Alerts"],
  ["/profile", "Account"],
] as const;

function NavIcon({ label }: { label: (typeof items)[number][1] }) {
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
  const { signedIn } = useAuthState();

  if (!signedIn || pathname.startsWith("/admin")) return null;

  return (
    <nav className="bottom-nav hc-bottom-tab-bar" aria-label="Mobile navigation">
      {items.map(([href, label]) => {
        const active = href === "/"
          ? pathname === "/" || pathname === "/dashboard"
          : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            <span className="bottom-nav-icon"><NavIcon label={label} /></span>
            <span className="bottom-nav-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
