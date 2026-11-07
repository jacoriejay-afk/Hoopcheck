import Link from "next/link";

type ReviewMembershipGateProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
};

export default function ReviewMembershipGate({
  title = "Full player reviews require an eligible membership",
  description = "Choose an eligible HoopCheck membership to unlock full player reviews and ratings.",
  actionLabel = "View Membership",
}: ReviewMembershipGateProps) {
  return (
    <section className="hero hc-review-membership-gate">
      <div className="card hc-team-membership-surface">
        <div className="eyebrow">MEMBERSHIP REQUIRED</div>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="actions">
          <Link href="/membership" className="btn">{actionLabel}</Link>
          <Link href="/login" className="btn dark">Sign in</Link>
        </div>
      </div>
    </section>
  );
}
