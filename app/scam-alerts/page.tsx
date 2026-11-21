import Link from "next/link";
import { PageShell } from "../../components/LayoutSystem";
import "./scam-alerts.css";

const signs = [
  {
    title: "Pay before you play",
    detail: "A supposed agent or team demands an upfront placement, visa, travel or roster fee without a verifiable club contract.",
  },
  {
    title: "Unverified identities",
    detail: "A person impersonates a coach, club or licensed agent, or insists that you keep their offer secret from the organization.",
  },
  {
    title: "Pressure and missing documents",
    detail: "You are rushed into payment or asked for passport scans, banking credentials or account passwords before validating an offer.",
  },
  {
    title: "Suspicious links",
    detail: "Tryouts or contracts arrive through unfamiliar domains or payment links that cannot be independently confirmed with the team.",
  },
];

export const metadata = {
  title: "Basketball Scam Alerts & Reporting | HoopCheck",
  description: "Recognize and confidentially report suspicious basketball agents, tryouts, offers and payment requests to HoopCheck.",
};

export default function ScamAlertsPage() {
  return <PageShell><main className="hc-alerts-page">
    <header className="hc-alerts-intro">
      <p className="hc-alerts-kicker">HOOPCHECK™ · PLAYER PROTECTION</p>
      <h1>Scam Alerts<span>.</span></h1>
      <p>Protect your basketball career. Learn the warning signs and send suspicious agent, tryout or team offers to HoopCheck for a private review.</p>
      <div className="hc-alerts-actions">
        <Link href="/support?scamAlert=1" className="hc-alerts-primary">Report a suspicious offer</Link>
        <Link href="/teams" className="hc-alerts-secondary">Verify a club</Link>
      </div>
    </header>
    <section aria-labelledby="hc-alerts-signs">
      <h2 id="hc-alerts-signs">Warning signs to check</h2>
      <div className="hc-alerts-grid">
        {signs.map(sign => <article key={sign.title} className="hc-alerts-card">
          <h3>{sign.title}</h3><p>{sign.detail}</p>
        </article>)}
      </div>
    </section>
    <section className="hc-alerts-process" aria-labelledby="hc-alerts-process-title">
      <h2 id="hc-alerts-process-title">What happens when you report?</h2>
      <p>Your signed-in report creates a private ticket in HoopCheck's existing support queue, where you can check its status. Do not post passport numbers, banking details, passwords or confidential documents in the report.</p>
      <p><strong>We do not publicly name or accuse people based on unreviewed reports.</strong> A public, moderated incident feed is not yet available; this page is the confidential intake and safety guide.</p>
      <Link href="/support?scamAlert=1">Submit a confidential report</Link>
    </section>
    <p className="hc-alerts-footnote">HoopCheck does not certify that every offer or club is legitimate. Verify independently through a club's confirmed official contact channels. If you have already shared payment credentials, contact your bank promptly.</p>
  </main></PageShell>;
}
