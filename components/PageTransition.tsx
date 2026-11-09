"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Animate the existing wrapper instead of remounting the page slot just to
 * restart a CSS animation. Next owns route state and scroll restoration.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = frame.current?.animate(
      [{ opacity: .86 }, { opacity: 1 }],
      { duration: 180, easing: "cubic-bezier(.22,1,.36,1)" },
    );
    return () => animation?.cancel();
  }, [pathname]);

  return (
    <div ref={frame} className="hc-route-transition" data-route={pathname}>
      {children}
    </div>
  );
}
