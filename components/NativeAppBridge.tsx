"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { usePathname, useRouter } from "next/navigation";
import NativeShareButton from "./NativeShareButton";

/**
 * Routes inbound universal/custom links into the existing Next.js router.
 * Native app setup still requires Associated Domains and URL-scheme config in Xcode.
 */
export default function NativeAppBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const isPublicProfile = /^\/(teams|womens|coaches|leagues|agents|players)\/[^/]+\/?$/.test(
    pathname || "",
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    let handle: { remove: () => Promise<void> } | undefined;

    void App.addListener("appUrlOpen", ({ url }) => {
      try {
        const incoming = new URL(url);
        const isHoopCheckHost =
          incoming.hostname === "hoopcheck.online" ||
          incoming.hostname === "www.hoopcheck.online";

        // Accept only the known first-party domain or the configured app scheme.
        if (!isHoopCheckHost && incoming.protocol !== "hoopcheck:") return;

        const path = incoming.pathname.startsWith("/")
          ? incoming.pathname
          : `/${incoming.pathname}`;
        router.push(`${path}${incoming.search}${incoming.hash}`);
      } catch {
        // Ignore malformed or untrusted incoming URLs.
      }
    }).then((listener) => {
      if (disposed) void listener.remove();
      else handle = listener;
    });

    return () => {
      disposed = true;
      if (handle) void handle.remove();
    };
  }, [router]);

  if (!Capacitor.isNativePlatform() || !isPublicProfile) return null;

  return (
    <NativeShareButton
      title={typeof document !== "undefined" ? document.title : "HoopCheck"}
      text="Check out this basketball profile on HoopCheck."
      className="native-profile-share"
    >
      Share
    </NativeShareButton>
  );
}
