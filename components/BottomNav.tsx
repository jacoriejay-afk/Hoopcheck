"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const items = [
  ["/feed","Feed","◉"],
  ["/search","Search","⌕"],
  ["/teams","Teams","▣"],
  ["/players","Players","🏀"],
  ["/account","Profile","●"],

] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!signedIn) return null;
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map(([href,label,icon]) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
          <span className="bottom-nav-icon" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </Link>;
      })}
    </nav>
  );
}
