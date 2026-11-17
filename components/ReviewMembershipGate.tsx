"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ReviewMembershipGateProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  accountType?: string;
  tier?: "free" | "pro" | "premium" | "member" | "player";
};

export default function ReviewMembershipGate({
  title = "Review access depends on your account and membership",
  description = "Player Pro and Premium members can read reviews and submit eligible player reviews. Fan Premium members can read full reviews, while Fan Pro members see a rating preview. Fans cannot submit reviews.",
  actionLabel = "View Membership",
  accountType = "",
  tier = "free",
}: ReviewMembershipGateProps) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => { let on = true; supabase.auth.getSession().then(({ data }) => { if (on) setSignedIn(Boolean(data.session)); }).catch(() => { if (on) setSignedIn(false); }); return () => { on = false; }; }, []);
  const signedOut = signedIn === false;
  const isFan = accountType === "fan";
  const isPlayer = accountType === "player";
  const resolvedTitle = isFan
    ? "Fan Premium unlocks full reviews and ratings"
    : isPlayer
      ? "Player Pro or Premium unlocks review access"
      : accountType
        ? title
        : signedOut
          ? "Sign in to view full review details"
          : title;
  const resolvedDescription = isFan
    ? tier === "pro"
      ? "Fan Pro shows the overall rating preview. Upgrade to Fan Premium to read full reviews and category details. Fan accounts cannot write reviews."
      : "Fan Premium unlocks full reviews and rating details. Fan Pro includes a rating preview. Fan accounts cannot write reviews."
    : isPlayer
      ? "Player Pro and Premium members can read full reviews and submit reviews when eligible and verified. Fan accounts cannot write reviews."
      : accountType
        ? description
        : signedOut
          ? "Sign in to choose a membership. Player Pro/Premium and Fan Premium can read full reviews; Fan Pro sees a preview. Only eligible players can submit reviews."
          : description;
  const resolvedActionLabel = isFan ? "View Fan Premium" : isPlayer ? "View Membership" : accountType ? actionLabel : "View Membership";

  return (
    <section className="hero hc-review-membership-gate">
      <div className="card hc-team-membership-surface">
        <div className="eyebrow">MEMBERSHIP REQUIRED</div>
        <h2>{resolvedTitle}</h2>
        <p>{resolvedDescription}</p>
        <div className="actions">
          <Link href="/membership" className="btn">{resolvedActionLabel}</Link>
          {signedOut && <Link href="/login" className="btn dark">Sign in</Link>}
        </div>
      </div>
    </section>
  );
}
