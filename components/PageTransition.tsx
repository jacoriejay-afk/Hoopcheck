"use client";

import { usePathname } from "next/navigation";

/**
 * Keep the route wrapper stable. Next App Router handles segment transitions
 * and loading boundaries; avoiding a pathname key prevents needless wrapper
 * remounts that can reset client state or amplify navigation jank.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="hc-route-transition" data-route={pathname}>
      {children}
    </div>
  );
}
