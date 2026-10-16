"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthState } from "./AuthProvider";

const items = [
  ["/", "Home", "⌂"],
  ["/search", "Search", "⌕"],
  ["/notifications", "Notifications", "♧"],
  ["/profile", "Profile", "●"],
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const { signedIn } = useAuthState();

  if (!signedIn || pathname.startsWith("/admin")) return null;

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map(([href, label, icon]) => {
        const active = href === "/"
          ? pathname === "/" || pathname === "/dashboard"
          : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            <span className="bottom-nav-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
