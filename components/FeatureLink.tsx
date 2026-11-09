"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { isAtLeastTier, type MembershipTier } from "../lib/membership-tier";
import { useAuthState } from "./AuthProvider";
import { HoopIcon } from "./HoopCheckUI";

type Props = {
  href: string;
  requiredTier?: MembershipTier;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  onClick?: () => void;
};

export default function FeatureLink({ href, requiredTier = "pro", className = "", children, ariaLabel, onClick }: Props) {
  const { membershipTier, ready, membershipReady, membershipError } = useAuthState();
  const locked = ready && membershipReady && !membershipError && !isAtLeastTier(membershipTier, requiredTier);
  return (
    <Link href={href} className={className + (locked ? " hc-feature-link is-tier-locked" : " hc-feature-link")}
      aria-label={ariaLabel}
      onClick={onClick}
      data-tier-locked={locked ? "true" : "false"}>
      {children}
      {locked && <span className="hc-feature-lock-state"><HoopIcon name="lock" size={13}/><small>{requiredTier === "premium" ? "Premium" : "Pro"}</small></span>}
    </Link>
  );
}
