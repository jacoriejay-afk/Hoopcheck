import type { Metadata } from "next";
import Link from "next/link";
import { requireAmbassadorSession } from "../../../lib/ambassador/server";
import { readCampaignReporting } from "../../../lib/owner/campaign-reporting";
export const metadata:Metadata={title:"Campaign attribution | HoopCheck™",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function CampaignReporting(){
 await requireAmbassadorSession("/owner-hq/campaigns",true);
 const report=await readCampaignReporting().catch(()=>null);
 return <main className="page-shell"><div className="page-container"><header className="hero-card"><h1>Campaign attribution</h1><Link href="/owner-hq" prefetch={false}>Back to Owner HQ</Link></header>
 <section className="dashboard-card"><p>All-time ambassador referral records, not unique visitors or a measured conversion funnel. Attributed records exclude disqualified referrals; qualified records also have a recorded first payment. No user-level details are displayed. This report does not alter commissions or payment attribution.</p>
 {!report?<p role="status">Campaign reporting unavailable.</p>:!report.rows.length?<p>No registered campaigns.</p>:<><div style={{overflowX:"auto"}} tabIndex={0} role="region" aria-label="Campaign results"><table style={{width:"100%",textAlign:"left"}}><thead><tr>{["Campaign","Recorded clicks","Eligible attribution records","Qualified paying records"].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{report.rows.map(row=><tr key={row.code}><th scope="row">{row.name} · {row.code}{!row.linked?" (not linked)":""}</th><td>{row.clicks??"Unavailable"}</td><td>{row.attributed??"Unavailable"}</td><td>{row.qualified??"Unavailable"}</td></tr>)}</tbody></table></div>{report.limited?<p>Showing the first 20 campaigns. This is a bounded report, not the complete registry.</p>:null}</>}
 </section></div></main>;
}
