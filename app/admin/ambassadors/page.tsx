import type { Metadata } from "next";
import { ambassadorDb, requireAmbassadorSession } from "../../../lib/ambassador/server";
import styles from "../../ambassador-hq/ambassador.module.css";
import { changeCampaign, changePayout } from "./actions";

export const metadata: Metadata = {
  title: "Ambassador administration | HoopCheck™",
  robots: { index: false, follow: false },
};

export default async function AmbassadorAdmin({ searchParams }: { searchParams: Promise<{ result?: string | string[] }> }) {
  await requireAmbassadorSession("/admin/ambassadors", true);
  const db = ambassadorDb();
  const [campaigns, grants, payouts] = await Promise.all([
    db.from("ambassador_campaigns").select("code,display_name").order("display_name"),
    db.from("ambassador_grants").select("id,code,status,activated_at,ends_at,first_rate_bps,commission_rate_bps,agreement_reference,payout_terms_reference"),
    db.from("ambassador_payouts").select("id,ambassador_id,amount_minor,status,paid_at").order("created_at", { ascending: false }).limit(100),
  ]);
  if (campaigns.error || grants.error || payouts.error) throw new Error("Ambassador administration is temporarily unavailable.");
  const result = (await searchParams).result;
  const reportMonth = new Date().toISOString().slice(0, 7);

  return (
    <main className="page-shell">
      <div className={`page-container ${styles.stack}`}>
        <header className="hero-card"><h1>Ambassador administration</h1></header>
        {result === "saved" && <p role="status">Changes saved.</p>}
        {result === "invalid" && <p role="alert">Check the form fields and try again.</p>}
        {result === "campaign-rejected" && <p role="alert">Campaign change refused. Check the verified account and signed terms.</p>}
        {result === "payout-rejected" && <p role="alert">Payout change refused. Check the payable balance, existing approval and transfer reference.</p>}
        {campaigns.data.map(campaign => {
          const grant = grants.data.find(item => item.code === campaign.code);
          const approved = payouts.data.find(item => item.ambassador_id === grant?.id && item.status === "approved");
          return <section key={campaign.code} className={`dashboard-card ${styles.stack}`}>
            <div>
              <h2>{campaign.display_name}</h2>
              <p>{campaign.code} · {grant?.activated_at && grant.ends_at <= new Date().toISOString()
                ? "Closed" : grant?.status ?? "Awaiting verified HoopCheck account"}</p>
            </div>
            {!grant ? <form className={styles.fields} action={changeCampaign}>
              <input type="hidden" name="code" value={campaign.code} />
              <label>Verified HoopCheck user ID<input name="userId" required maxLength={36} /></label>
              <button className="btn" name="action" value="link">Approve HQ access</button>
            </form> : <>
              <form className={styles.fields} action={changeCampaign}>
                <input type="hidden" name="code" value={campaign.code} />
                <label>First-payment rate (%)<input name="first" type="number" min="0" max="100" step=".01" required defaultValue={grant.first_rate_bps == null ? "" : grant.first_rate_bps / 100} /></label>
                <label>Renewal rate (%)<input name="renewal" type="number" min="0" max="100" step=".01" required defaultValue={grant.commission_rate_bps == null ? "" : grant.commission_rate_bps / 100} /></label>
                <label>Agreement signed date<input name="signed" type="date" required /></label>
                <label>Signed agreement reference<input name="agreement" maxLength={160} required defaultValue={grant.agreement_reference ?? ""} /></label>
                <label>Confirmed payout terms reference<input name="terms" maxLength={160} required defaultValue={grant.payout_terms_reference ?? ""} /></label>
                {!grant.activated_at && <label>Campaign length (days)<input name="days" type="number" min="1" max="366" defaultValue="90" required /></label>}
                <button className="btn" name="action" value={grant.activated_at ? "amend" : "activate"}>{grant.activated_at ? "Record signed amendment" : "Confirm terms and activate"}</button>
              </form>
              {grant.status === "active" && <form action={changeCampaign}>
                <input type="hidden" name="code" value={campaign.code} />
                <button className="btn dark" name="action" value="pause">Close campaign to new referrals</button>
              </form>}
              <section>
                <h3>Payout review</h3>
                {approved ? <>
                  <p>Approved for manual payment · ${(approved.amount_minor / 100).toFixed(2)}</p>
                  <form className={styles.fields} action={changePayout}>
                    <input type="hidden" name="ambassador" value={grant.id} />
                    <label>External transfer reference<input name="reference" required maxLength={160} /></label>
                    <button className="btn" name="action" value="settle">Record completed transfer</button>
                    <button className="btn dark" name="action" value="cancel" formNoValidate>Cancel approval</button>
                  </form>
                </> : <form action={changePayout}>
                  <input type="hidden" name="ambassador" value={grant.id} />
                  <button className="btn" name="action" value="approve">Approve eligible balance</button>
                </form>}
                <ul className={styles.list}>
                  {payouts.data.filter(item => item.ambassador_id === grant.id).map(item => <li className={styles.row} key={item.id}>
                    <span>{item.paid_at?.slice(0, 10) ?? "Awaiting settlement"}</span>
                    <span>{item.status}</span><strong>${(item.amount_minor / 100).toFixed(2)}</strong>
                  </li>)}
                </ul>
              </section>
            </>}
          </section>;
        })}
        <section className="dashboard-card">
          <h2>Monthly commission report</h2>
          <form action="/admin/ambassadors/export" className={styles.fields}>
            <label>Report month (UTC)<input name="month" type="month" defaultValue={reportMonth} required /></label>
            <button className="btn" type="submit">Download CSV</button>
          </form>
        </section>
      </div>
    </main>
  );
}
