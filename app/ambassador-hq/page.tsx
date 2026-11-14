import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { HoopIcon } from "../../components/HoopCheckUI";
import { ambassadorDb, requireAmbassadorSession } from "../../lib/ambassador/server";
import styles from "./ambassador.module.css";
import ReferralCopy from "./ReferralCopy";

export const metadata: Metadata = {
  title: "Ambassador HQ | HoopCheck™",
  robots: { index: false, follow: false },
};

type Commission = {
  id: string;
  attribution_id: string;
  currency: string;
  subscription_plan: string;
  paid_invoice_at: string;
  gross_minor: number;
  tax_minor: number;
  fee_minor: number;
  discount_minor: number;
  adjustment_minor: number;
  commission_rate_bps: number;
  earnings: number;
  status: string;
};
type Dashboard = {
  code: string;
  status: string;
  active: boolean;
  clicks: number;
  signups: number;
  conversions: number;
  totals: { currency: string; earned: number }[];
  commissions: Commission[];
  referrals: { id: string; captured_at: string; first_paid_at: string | null; stripe_status: string | null }[];
  payouts: { id: string; currency: string; amount_minor: number; status: string; approved_at: string | null; paid_at: string | null }[];
};

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default async function AmbassadorHQ() {
  const user = await requireAmbassadorSession("/ambassador-hq");
  const { data, error } = await ambassadorDb().rpc("ambassador_dashboard", { p_user: user.id });
  if (error) throw new Error("Ambassador HQ is temporarily unavailable.");
  if (!data) notFound();
  const dashboard = data as Dashboard;

  return (
    <main className="page-shell">
      <div className={`page-container ${styles.stack}`}>
        <header className="hero-card">
          {dashboard.active && <span className={`eyebrow ${styles.badge}`}>
            <HoopIcon name="shield-check" size={18} /> Official HoopCheck™ Ambassador
          </span>}
          <h1>Ambassador HQ</h1>
          <p className="muted">{dashboard.active ? "Your referral campaign is active."
            : dashboard.status === "pending" ? "Campaign awaiting signed terms and owner activation."
            : "Your referral campaign is closed to new signups."}</p>
        </header>
        <section className={styles.metrics} aria-label="Campaign totals">
          <article className="dashboard-card">Referral link visits<strong className={styles.metric}>{dashboard.clicks}</strong></article>
          <article className="dashboard-card">Verified signups<strong className={styles.metric}>{dashboard.signups}</strong></article>
          <article className="dashboard-card">Paid conversions<strong className={styles.metric}>{dashboard.conversions}</strong></article>
          <article className="dashboard-card">Commission earnings
            <strong className={styles.metric}>{dashboard.totals.map(total => money(total.earned, total.currency)).join(" · ") || "$0.00"}</strong>
          </article>
        </section>
        <section className="dashboard-card">
          <h2>Referral link and promotional materials</h2>
          {dashboard.active ? <>
            <p>Referral code <strong>{dashboard.code}</strong></p>
            <ReferralCopy link={`https://hoopcheck.online/referral/${dashboard.code}`} />
            <p>“Know who you’re signing with. Explore HoopCheck™ with my referral link. I may earn a commission if you subscribe.”</p>
            <a href="/hoopcheck-logo.svg" download className="btn dark">
              <Image src="/hoopcheck-logo.svg" alt="" width={27} height={27} /> Download HoopCheck™ logo
            </a>
          </> : <p className="muted">Campaign links and materials are available during an active campaign.</p>}
        </section>
        <section className="dashboard-card">
          <h2>Recent referrals</h2>
          {dashboard.referrals.length === 0 ? <p className="muted">No verified signups yet.</p> :
            <ul className={styles.list}>
              {dashboard.referrals.map(referral => <li key={referral.id} className={styles.row}>
                <strong>Referral {referral.id.slice(0, 8)}</strong>
                <span className="muted">Signed up {date(referral.captured_at)}
                  {referral.first_paid_at && <> · Converted {date(referral.first_paid_at)}</>}
                </span>
                <span>{referral.stripe_status ?? "Signed up"}</span>
              </li>)}
            </ul>}
        </section>
        <section className="dashboard-card">
          <h2>Recent commissions</h2>
          {dashboard.commissions.length === 0 ? <p className="muted">No commissions yet.</p> :
            <ul className={styles.list}>
              {dashboard.commissions.map(item => <li key={item.id} className={styles.row}>
                <div>
                  <strong>{date(item.paid_invoice_at)}</strong>
                  <div className="muted">Referral {item.attribution_id.slice(0, 8)} · {item.subscription_plan}</div>
                </div>
                <div className="muted">
                  {money(item.gross_minor, item.currency)} collected · {item.commission_rate_bps / 100}% rate
                  <br />{money(item.tax_minor + item.fee_minor + item.adjustment_minor, item.currency)} in deductions
                  {item.discount_minor > 0 && <> · {money(item.discount_minor, item.currency)} pre-payment discount</>}
                </div>
                <div>
                  <strong>{money(item.earnings, item.currency)}</strong>
                  <div className="muted">{item.earnings === 0 && item.adjustment_minor > 0 ? "Reversed" : item.status}</div>
                </div>
              </li>)}
            </ul>}
        </section>
        <section className="dashboard-card">
          <h2>Payment history</h2>
          {dashboard.payouts.length === 0 ? <p className="muted">No payments recorded yet.</p> :
            <ul className={styles.list}>
              {dashboard.payouts.map(payout => <li key={payout.id} className={styles.row}>
                <span>{payout.paid_at ? date(payout.paid_at) : payout.approved_at ? date(payout.approved_at) : "Pending review"}</span>
                <span className="muted">{payout.status}</span>
                <strong>{money(payout.amount_minor, payout.currency)}</strong>
              </li>)}
            </ul>}
        </section>
      </div>
    </main>
  );
}
