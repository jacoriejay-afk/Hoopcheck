"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { trackNavigationHistory } from "../lib/navigation-history";

function getFallbackPath(pathname: string): string {
  if (pathname === "/") return "/dashboard";
  if (pathname === "/dashboard") return "/";
  // Signed-out authentication pages must never fall back to a protected dashboard.
  if (pathname === "/login" || pathname.startsWith("/login/") || pathname === "/signup" || pathname.startsWith("/signup/") || pathname === "/forgot-password" || pathname === "/reset-password") return "/";
  if (pathname.startsWith("/team-hub/groups/")) return "/team-hub";
  if (pathname.startsWith("/team-hub/")) return "/team-hub";
  if (pathname.startsWith("/teams/")) return "/teams";
  if (pathname.startsWith("/players/")) return "/players";
  if (pathname.startsWith("/coaches/")) return "/coaches";
  if (pathname.startsWith("/leagues/")) return "/leagues";
  if (pathname.startsWith("/womens/")) return "/womens";
  if (pathname.startsWith("/fans/")) return "/fans";
  if (pathname.startsWith("/reviews/")) return "/reviews";
  if (pathname.startsWith("/profile/")) return "/profile";
  // Avoid sending a direct-entry admin/users page back to itself.
  if (pathname === "/admin/users" || pathname === "/admin/users/") return "/dashboard";
  // There is no /admin landing route; use a real, permission-checked admin page.
  if (pathname.startsWith("/admin/")) return "/admin/users";
  if (pathname.startsWith("/search/")) return "/search";
  return "/dashboard";
}

/**
 * Universal back control. An app-owned history marker distinguishes an
 * in-app navigation from a direct entry; direct entries use a valid local
 * parent route rather than relying on an unrelated browser-history entry.
 */
export default function GlobalBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useRef<ReturnType<typeof trackNavigationHistory> | null>(null);
  useEffect(() => {
    const tracker = trackNavigationHistory(window);
    navigation.current = tracker;
    return () => { tracker.dispose(); navigation.current = null; };
  }, []);

  const goBack = useCallback(() => {
    if (typeof window === "undefined") return;

    if (navigation.current?.canGoBack()) {
      router.back();
      return;
    }

    router.push(getFallbackPath(pathname));
  }, [pathname, router]);

  // The public landing page is a navigation root, not a detail view.
  if (pathname === "/") return null;

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
