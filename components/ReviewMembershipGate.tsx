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
  title = "Full review details require an eligible membership",
  description = "An eligible active membership unlocks full review details.",
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
      ? "Player Pro or Premium membership required"
      : accountType
        ? title
        : signedOut
          ? "Sign in to view full review details"
          : title;
  const resolvedDescription = isFan
    ? tier === "pro"
      ? "Fan Pro shows the overall rating preview. Upgrade to Fan Premium to unlock full reviews and category details."
      : "Choose Fan Premium to unlock full reviews and rating details across HoopCheck."
    : isPlayer
      ? "An active Pro or Premium player membership unlocks full review details and review-writing access."
      : accountType
        ? description
        : signedOut
          ? "Sign in and choose an eligible HoopCheck membership to view full review details."
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
