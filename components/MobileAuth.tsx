"use client";


import Link from "next/link";
import { useAuthState } from "./AuthProvider";

export default function MobileAuth() {
  const { signedIn } = useAuthState();

  if (!signedIn) return null;

  return (
    <Link href="/dashboard" className="mobile-auth-global">
      Dashboard
    </Link>
  );
}
