"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/feed","Feed","◉"],
  ["/search","Search","⌕"],
  ["/teams","Teams","▣"],
  ["/players","Players","♙"],
  ["/account","Profile","●"],
  ["/support","Help","?"],
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map(([href,label,icon]) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
        return <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
          <span className="bottom-nav-icon" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </Link>;
      })}
    </nav>
  );
}
