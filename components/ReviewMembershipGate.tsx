import Link from "next/link";

type ReviewMembershipGateProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  accountType?: string;
  tier?: "free" | "pro" | "premium" | "member" | "player";
};

export default function ReviewMembershipGate({
  title = "Full review details require an eligible membership",
  description = "Sign in with an eligible active membership to view full review details.",
  actionLabel = "View Membership",
  accountType = "",
  tier = "free",
}: ReviewMembershipGateProps) {
  const isFan = accountType === "fan";
  const isPlayer = accountType === "player";
  const resolvedTitle = isFan
    ? "Fan Premium unlocks full reviews and ratings"
    : isPlayer
      ? "Player Pro or Premium membership required"
      : accountType
        ? title
        : "Sign in to view full review details";
  const resolvedDescription = isFan
    ? tier === "pro"
      ? "Fan Pro shows the overall rating preview. Upgrade to Fan Premium to unlock full reviews and category details."
      : "Choose Fan Premium to unlock full reviews and rating details across HoopCheck."
    : isPlayer
      ? "An active Pro or Premium player membership unlocks full review details and review-writing access."
      : accountType
        ? description
        : "Sign in and choose an eligible HoopCheck membership to view full review details.";
  const resolvedActionLabel = isFan ? "View Fan Premium" : isPlayer ? "View Membership" : accountType ? actionLabel : "View Membership";

  return (
    <section className="hero hc-review-membership-gate">
      <div className="card hc-team-membership-surface">
        <div className="eyebrow">MEMBERSHIP REQUIRED</div>
        <h2>{resolvedTitle}</h2>
        <p>{resolvedDescription}</p>
        <div className="actions">
          <Link href="/membership" className="btn">{resolvedActionLabel}</Link>
          <Link href="/login" className="btn dark">Sign in</Link>
        </div>
      </div>
    </section>
  );
}
