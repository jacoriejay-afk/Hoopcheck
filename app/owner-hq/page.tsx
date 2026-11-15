import type { Metadata } from "next";
import Link from "next/link";
import OwnerRolePreview from "./OwnerRolePreview";
import { getOwnerStripeSummary } from "../../lib/owner/stripe-summary";
import { ambassadorDb, requireAmbassadorSession } from "../../lib/ambassador/server";

export const metadata: Metadata = {
  title: "Owner HQ | HoopCheck™",
  robots: { index: false, follow: false },
};

const views = [
  { name: "Player HQ", href: "/dashboard" },
  { name: "Fan HQ", href: "/team-hub" },
  { name: "Agents HQ", href: "/agents-hq" },
  { name: "Team HQ", href: "/team-dashboard" },
  { name: "Ambassador HQ", href: "/ambassador-hq" },
] as const;

async function getOwnerMetrics() {
  const metrics = [
    { label: "Registered profiles", table: "profiles", column: "id" },
    { label: "Active/trialing subscription records", table: "subscriptions", column: "user_id" },
    { label: "Ambassador campaigns", table: "ambassador_campaigns", column: "code" },
    { label: "Commission records", table: "ambassador_commissions", column: "id" },
  ] as const;

  // Previews can verify account access without privileged database credentials.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return metrics.map(({ label }) => ({ label, value: "Unavailable" }));
  }

  const db = ambassadorDb();
  return Promise.all(metrics.map(async ({ label, table, column }) => {
    const query = db.from(table).select(column, { count: "exact", head: true });
    const { count, error } = await (table === "subscriptions"
      ? query.in("status", ["active", "trialing"])
      : query);
    return { label, value: error || count == null ? "Unavailable" : String(count) };
  }));
}

export default async function OwnerHQ() {
  await requireAmbassadorSession("/owner-hq", true);
  const [stripeSummary, metrics] = await Promise.all([
    getOwnerStripeSummary(),
    getOwnerMetrics(),
  ]);
  return <main className="page-shell">
    <div className="page-container" style={{ display: "grid", gap: 20, paddingBlock: 24 }}>
      <header className="hero-card">
        <p style={{ textTransform: "uppercase", letterSpacing: ".12em" }}>HoopCheck™ · Private owner workspace</p>
        <h1>Owner HQ</h1>
        <p>Platform metrics, Stripe activity, and account access previews.</p>
      </header>
      <section aria-label="Platform metrics" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {metrics.map(item => <div className="dashboard-card" key={item.label}>
          <p>{item.label}</p><strong style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)" }}>{item.value}</strong>
        </div>)}
      </section>
      <section className="dashboard-card">
        <h2>Business operations</h2>
        <p>Stripe paid invoices created in the past 30 days (USD only). This is gross paid invoice volume before refunds, processing fees and taxes; it is not net revenue or MRR.</p>
        {stripeSummary.error ? <p role="status">Stripe reporting unavailable. No financial totals shown.</p> : <div style={{display:"flex",gap:24,flexWrap:"wrap"}}><p><strong>{stripeSummary.paidInvoices}</strong> paid invoices</p><p><strong>{stripeSummary.activeSubscriptions ?? "Unavailable"}</strong> active Stripe subscriptions</p><p><strong>{new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(stripeSummary.grossPaidMinor/100)}</strong> gross paid invoice volume</p><p><strong>{stripeSummary.refundedMinor == null ? "Unavailable" : new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(stripeSummary.refundedMinor/100)}</strong> successful USD refunds created in the last 30 days</p></div>}
        {stripeSummary.incomplete && <p role="status">Partial results: invoice pagination limit reached.</p>}
        {stripeSummary.subscriptionsIncomplete && <p role="status">Partial results: subscription pagination limit reached.</p>}
        {stripeSummary.refundsIncomplete && <p role="status">Partial results: refund pagination limit reached.</p>}
        <p>Refunds are tracked by refund creation date, while paid invoices are grouped by invoice creation date. Do not subtract these figures to calculate net revenue.</p>
        <p><Link href="/admin/ambassadors">Manage ambassador campaigns, agreements and payouts</Link></p>
      </section>
      <OwnerRolePreview />
      <section className="dashboard-card">
        <h2>Open existing dashboards</h2>
        <p>Dashboard links use the permissions of your signed-in account.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {views.map(view => <Link className="dashboard-card" key={view.name} href={view.href}>
            <strong>{view.name}</strong>
          </Link>)}
        </div>
      </section>
    </div>
  </main>;
}
