import type { Metadata } from "next";
import Link from "next/link";
import OwnerRolePreview from "./OwnerRolePreview";
import { getOwnerStripeSummary } from "../../lib/owner/stripe-summary";
import { ambassadorDb, getAmbassadorWorkspace, requireAmbassadorSession } from "../../lib/ambassador/server";

export const metadata: Metadata = {
  title: "Owner HQ | HoopCheck™",
  robots: { index: false, follow: false },
};

const views = [
  { name: "Player HQ", href: "/dashboard" },
  { name: "Fan HQ", href: "/team-hub" },
  { name: "Agents HQ", href: "/agents-hq" },
  { name: "Team HQ", href: "/team-dashboard" },
] as const;

async function getReferralClickTotal(db: ReturnType<typeof ambassadorDb> | null) {
  const label = "Ambassador referral clicks";
  if (!db) return { label, value: "Unavailable" };

  const pageSize = 100;
  let afterId: string | undefined;
  let total = BigInt(0);
  for (;;) {
    const page = db.from("ambassador_clicks").select("ambassador_id, clicks")
      .order("ambassador_id").limit(pageSize);
    const { data, error } = await (afterId ? page.gt("ambassador_id", afterId) : page);
    if (error || !data) return { label, value: "Unavailable" };
    for (const { clicks } of data) {
      if (!Number.isSafeInteger(clicks) || clicks < 0) return { label, value: "Unavailable" };
      total += BigInt(clicks);
    }
    if (data.length < pageSize) return { label, value: String(total) };
    afterId = data[data.length - 1].ambassador_id;
  }
}

async function getOwnerMetrics() {
  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? ambassadorDb() : null;
  const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  const options = { count: "exact", head: true } as const;

  async function metric(
    label: string,
    query?: PromiseLike<{ count: number | null; error: unknown }>,
  ) {
    const result = await query;
    const value = !result || result.error || result.count == null ? "Unavailable" : String(result.count);
    return { label, value };
  }

  return Promise.all([
    metric("Registered profiles", db?.from("profiles").select("*", options)),
    metric("Profiles created in the last 30 days", db?.from("profiles").select("*", options)
      .gte("created_at", since)),
    metric("Active/trialing subscription records", db?.from("subscriptions").select("*", options)
      .in("status", ["active", "trialing"])),
    getReferralClickTotal(db),
    metric("Attributed signups", db?.from("ambassador_attributions").select("*", options)),
    metric("Qualified paying referrals", db?.from("ambassador_attributions").select("*", options)
      .not("first_paid_at", "is", null).is("disqualified_at", null)),
    metric("Pending commission records", db?.from("ambassador_commissions").select("*", options)
      .eq("status", "pending")),
    metric("Approved payouts awaiting payment", db?.from("ambassador_payouts").select("*", options)
      .eq("status", "approved")),
  ]);
}

export default async function OwnerHQ() {
  const user = await requireAmbassadorSession("/owner-hq", true);
  const [stripeSummary, metrics, ambassador] = await Promise.all([
    getOwnerStripeSummary(),
    getOwnerMetrics(),
    getAmbassadorWorkspace(user.id),
  ]);
  return <main className="page-shell">
    <div className="page-container" style={{ display: "grid", gap: 20, paddingBlock: 24 }}>
      <header className="hero-card">
        <p style={{ textTransform: "uppercase", letterSpacing: ".12em" }}>HoopCheck™ · Private owner workspace</p>
        <h1>Owner HQ</h1>
        <p>Platform metrics, Stripe activity, and account access previews.</p>
        <nav className="hc-social-profile-nav" aria-label="Owner workspace shortcuts">
          <Link href="/account">Account</Link>
          <Link href="/admin/directory">Admin Control Center</Link>
          <Link href="/admin/ambassadors" prefetch={false}>Ambassador administration</Link>
          {ambassador && <Link href="/ambassador-hq" prefetch={false}>My Ambassador HQ</Link>}
        </nav>
      </header>
      <section aria-label="Platform metrics" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {metrics.map(item => <div className="dashboard-card" key={item.label}>
          <p>{item.label}</p><strong style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)" }}>{item.value}</strong>
        </div>)}
      </section>
      <section className="dashboard-card">
        <h2>Business operations</h2>
        <p>Paid USD invoices created in the past 30 days (grouped by invoice creation date, not payment date). This is gross paid invoice volume before refunds, processing fees and taxes; it is not cash received in the period, net revenue, or MRR.</p>
        {stripeSummary.error ? <p role="status">Stripe reporting unavailable. No financial totals shown.</p> : <div style={{display:"flex",gap:24,flexWrap:"wrap"}}><p><strong>{stripeSummary.paidInvoices}</strong> paid invoices</p><p><strong>{stripeSummary.activeSubscriptions ?? "Unavailable"}</strong> active Stripe subscriptions</p><p><strong>{new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(stripeSummary.grossPaidMinor/100)}</strong> gross paid invoice volume</p><p><strong>{stripeSummary.refundedMinor == null ? "Unavailable" : new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(stripeSummary.refundedMinor/100)}</strong> successful USD refunds created in the last 30 days</p></div>}
        {stripeSummary.incomplete && <p role="status">Partial results: invoice pagination limit reached.</p>}
        {stripeSummary.subscriptionsIncomplete && <p role="status">Partial results: subscription pagination limit reached.</p>}
        {stripeSummary.refundsIncomplete && <p role="status">Partial results: refund pagination limit reached.</p>}
        <p>Refunds are tracked by refund creation date, while paid invoices are grouped by invoice creation date. Do not subtract these figures to calculate net revenue.</p>
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
