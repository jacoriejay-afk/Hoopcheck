"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

function getFallbackPath(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") return "/";
  if (pathname.startsWith("/teams/")) return "/teams";
  if (pathname.startsWith("/players/")) return "/players";
  if (pathname.startsWith("/coaches/")) return "/coaches";
  if (pathname.startsWith("/leagues/")) return "/leagues";
  if (pathname.startsWith("/womens/")) return "/womens";
  if (pathname.startsWith("/reviews/")) return "/reviews";
  if (pathname.startsWith("/profile/")) return "/profile";
  if (pathname.startsWith("/admin/")) return "/admin";
  if (pathname.startsWith("/search/")) return "/search";
  return "/dashboard";
}

/**
 * Universal back control. Next App Router records an index in history.state;
 * when there is no prior in-app entry, navigate to a sensible local parent.
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
    <button
      type="button"
      className="global-back-button"
      onClick={goBack}
      aria-label="Go back"
    >
      <span aria-hidden="true">←</span> Back
    </button>
  );
}
