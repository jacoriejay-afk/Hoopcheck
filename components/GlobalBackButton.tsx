"use client";

import { usePathname, useRouter } from "next/navigation";

export default function GlobalBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return null;
  return <button type="button" className="global-back-button" onClick={() => { if (window.history.length > 1) router.back(); else router.push("/dashboard"); }} aria-label="Go back">← Back</button>;
}
