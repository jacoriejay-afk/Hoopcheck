"use client";

import { usePathname } from "next/navigation";

/**
 * Shared route content wrapper.
 *
 * Intentionally does not key/remount the wrapper by pathname: Next App Router
 * owns route changes and should retain shared/client state where possible.
 * Route-level loading.tsx boundaries provide feedback while segments load.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="hc-route-transition" data-route={pathname}>
      {children}
    </div>
  );
}
