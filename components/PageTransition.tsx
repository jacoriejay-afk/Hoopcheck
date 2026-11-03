"use client";

import { usePathname } from "next/navigation";

/**
 * Key the page slot to its pathname so the shared, lightweight entrance
 * animation restarts on route changes. Global providers and navigation live
 * outside this wrapper and remain mounted.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="hc-route-transition" data-route={pathname}>
      {children}
    </div>
  );
}
