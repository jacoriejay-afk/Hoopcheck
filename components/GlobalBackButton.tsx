"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Universal in-app back control.
 * Prefer browser history only when the previous document is same-origin;
 * direct/external entries use a stable in-app destination instead.
 */
export default function GlobalBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  const goBack = useCallback(() => {
    if (typeof window === "undefined") {
      router.push("/dashboard");
      return;
    }

    const referrer = document.referrer;
    let sameOriginReferrer = false;

    if (referrer) {
      try {
        sameOriginReferrer = new URL(referrer).origin === window.location.origin;
      } catch {
        sameOriginReferrer = false;
      }
    }

    if (window.history.length > 1 && sameOriginReferrer) {
      router.back();
      return;
    }

    // Safe fallback for direct links, external referrals, and empty history.
    router.push(pathname === "/dashboard" ? "/" : "/dashboard");
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
