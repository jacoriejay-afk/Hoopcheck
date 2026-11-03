"use client";

import { usePathname } from "next/navigation";

/**
 * Animate the page slot on route changes. The key remounts only this content
 * wrapper; shared providers, header, navigation, and auth state stay mounted.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="hc-route-transition" data-route={pathname}>
      {children}
    </div>
  );
}
