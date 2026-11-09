"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

function getFallbackPath(pathname: string): string {
  if (pathname === "/") return "/dashboard";
  if (pathname === "/dashboard") return "/";
  if (pathname.startsWith("/teams/")) return "/teams";
  if (pathname.startsWith("/players/")) return "/players";
  if (pathname.startsWith("/coaches/")) return "/coaches";
  if (pathname.startsWith("/leagues/")) return "/leagues";
  if (pathname.startsWith("/womens/")) return "/womens";
  if (pathname.startsWith("/fans/")) return "/fans";
  if (pathname.startsWith("/reviews/")) return "/reviews";
  if (pathname.startsWith("/profile/")) return "/profile";
  // There is no /admin landing route; use a real, permission-checked admin page.
  if (pathname.startsWith("/admin/")) return "/admin/users";
  if (pathname.startsWith("/search/")) return "/search";
  return "/dashboard";
}

/**
 * Universal back control. Next App Router's history index distinguishes an
 * in-app navigation from a direct entry; direct entries use a valid local
 * parent route rather than relying on an unrelated browser-history entry.
 */
export default function GlobalBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  const goBack = useCallback(() => {
    if (typeof window === "undefined") return;

    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      router.back();
      return;
    }

    router.push(getFallbackPath(pathname));
  }, [pathname, router]);

  return (
    <div className="global-back-wrap">
    <button
      type="button"
      className="global-back-button"
      onClick={goBack}
      aria-label="Go back"
    >
      <span aria-hidden="true">←</span> Back
    </button>
    </div>
  );
}
