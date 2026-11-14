import type { Metadata } from "next";
import Link from "next/link";
import { ambassadorDb, requireAmbassadorSession } from "../../lib/ambassador/server";

export const metadata: Metadata = {
  title: "Owner HQ | HoopCheck™",
  robots: { index: false, follow: false },
};

const views = [
  { name: "Player HQ", href: "/player-hq", description: "Review the player experience" },
  { name: "Fan HQ", href: "/fan-hq", description: "Review fan communities and tools" },
  { name: "Agents HQ", href: "/agents-hq", description: "Review agent and scout tools" },
  { name: "Team HQ", href: "/team-hq", description: "Review club management" },
  { name: "Ambassador HQ", href: "/ambassador-hq", description: "Review ambassador experience" },
] as const;

export default async function OwnerHQ() {
  await requireAmbassadorSession("/owner-hq", true);
  const db = ambassadorDb();
  const [members, subscriptions, campaigns, commissions] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("subscriptions").select("user_id", { count: "exact", head: true }).in("status", ["active", "trialing"]),
    db.from("ambassador_campaigns").select("code", { count: "exact", head: true }),
    db.from("ambassador_commissions").select("id", { count: "exact", head: true }),
  ]);
  const metrics = [
    { label: "Registered profiles", value: members.error ? "Unavailable" : String(members.count ?? 0) },
    { label: "Active/trialing subscription records", value: subscriptions.error ? "Unavailable" : String(subscriptions.count ?? 0) },
    { label: "Ambassador campaigns", value: campaigns.error ? "Unavailable" : String(campaigns.count ?? 0) },
    { label: "Commission records", value: commissions.error ? "Unavailable" : String(commissions.count ?? 0) },
  ];
  return <main className="page-shell">
    <div className="page-container" style={{ display: "grid", gap: 20, paddingBlock: 24 }}>
      <header className="hero-card">
        <p style={{ textTransform: "uppercase", letterSpacing: ".12em" }}>HoopCheck™ · Private owner workspace</p>
        <h1>Owner HQ</h1>
        <p>Business overview and secure access to platform management. Figures below are live database record counts, not revenue or Stripe sales.</p>
      </header>
      <section aria-label="Platform metrics" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {metrics.map(item => <div className="dashboard-card" key={item.label}>
          <p>{item.label}</p><strong style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)" }}>{item.value}</strong>
        </div>)}
      </section>
      <section className="dashboard-card">
        <h2>Business operations</h2>
        <p>Sales totals and recurring revenue require a verified Stripe reporting integration. No estimated revenue is displayed as real data.</p>
        <p><Link href="/admin/ambassadors">Manage ambassador campaigns, agreements and payouts</Link></p>
      </section>
      <section className="dashboard-card">
        <h2>Switch view</h2>
        <p>These links open existing role pages using your current account. They do not impersonate users, override membership checks, or change your real account type. A true Free/Pro/Premium preview simulator requires separate read-only UI support.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {views.map(view => <Link className="dashboard-card" key={view.name} href={view.href}>
            <strong>{view.name}</strong><p>{view.description}</p>
          </Link>)}
        </div>
      </section>
    </div>
  </main>;
}
