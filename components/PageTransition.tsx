"use client";

import { usePathname } from "next/navigation";

/**
 * Keeps one shared, lightweight entrance animation for every App Router page.
 * Keying by pathname remounts only the page slot; global providers and navigation
 * remain mounted, so auth/theme/language state does not reset on navigation.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="hc-route-transition" data-route={pathname}>
      {children}
    </div>
  );
}
