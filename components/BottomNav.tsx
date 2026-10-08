"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuthState } from "./AuthProvider";

const items = [
  ["/feed","Feed","◉"],
  ["/search","Search","⌕"],
  ["/teams","Teams","▣"],
  ["/players","Players","🏀"],
  ["__PROFILE__","Profile","●"],

] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const { signedIn } = useAuthState();

  if (!signedIn) return null;
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map(([href,label,icon]) => {
        const resolvedHref = href === "__PROFILE__" ? "/profile" : href;
        const active = pathname === resolvedHref || pathname.startsWith(resolvedHref + "/");
        return <Link key={href} href={resolvedHref} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
          <span className="bottom-nav-icon" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </Link>;
      })}
    </nav>
  );
}
