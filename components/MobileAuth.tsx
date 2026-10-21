"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthState } from "./AuthProvider";

export default function MobileAuth() {
  const { signedIn } = useAuthState();
  const pathname = usePathname();

  if (!signedIn || pathname === "/dashboard" || pathname.startsWith("/admin")) return null;

  return (
    <Link href="/dashboard" className="mobile-auth-global">
      Dashboard
    </Link>
  );
}
