import type { Metadata } from "next";
import Link from "next/link";
import { requireAmbassadorSession } from "../../../lib/ambassador/server";
import { GROWTH_TARGET, growthSummary, parseGrowthSnapshot } from "../../../lib/owner/growth-snapshot";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Launch growth | HoopCheck™",robots:{index:false,follow:false}};
const labels={signup_conversion:"Signup conversion",day7_retention:"Day 7 retention",paid_conversion:"Paid conversion",referral_conversion:"Referral conversion"};
export default async function GrowthPage(){
 await requireAmbassadorSession("/owner-hq/growth",true);
 const enabled=process.env.HOOPCHECK_GROWTH_REPORT_ENABLED==="true";
 const snapshot=enabled?parseGrowthSnapshot(process.env.HOOPCHECK_GROWTH_REPORT_JSON):null;
 const summary=growthSummary(snapshot);
 return <main className="page-shell"><div className="page-container" style={{display:"grid",gap:16}}>
 <header className="hero-card"><p className="eyebrow">PRIVATE OWNER WORKSPACE</p><h1>Launch growth</h1><p>Goal: {GROWTH_TARGET.toLocaleString("en-US")} weekly active accounts across web, iOS and Android.</p><Link href="/owner-hq" prefetch={false}>Back to Owner HQ</Link></header>
 <section className="dashboard-card"><h2>Weekly active accounts</h2>
 {!enabled?<p role="status">Growth reporting disabled pending review.</p>:!snapshot?<p role="status">No valid recent reviewed aggregate observation supplied.</p>:<p>UTC window: {snapshot.windowStart} to {snapshot.windowEnd} (exclusive). Source: {snapshot.source}. Coverage: web, iOS and Android.</p>}
 <p><strong>{summary.weeklyActiveUsers?.toLocaleString("en-US")??"Unavailable"}</strong> weekly active accounts</p>
 {summary.progress!==null&&<><progress value={summary.progress} max={100} aria-label="Progress toward 1,000 weekly active accounts"/><p>{summary.remaining?.toLocaleString("en-US")} remaining to reach target.</p></>}
 <p>Unique authenticated accounts with an independently reviewed qualifying action, deduplicated across platforms. Not registered profiles, downloads, page views or last-seen estimates.</p></section>
 <section className="dashboard-card"><h2>Reviewed cohort metrics</h2><dl>{summary.rates.map(row=><div key={row.metric}><dt>{labels[row.metric]}</dt><dd>{row.percent===null?"Unavailable or suppressed":row.percent.toFixed(1)+"%"}</dd></div>)}</dl><p>Only aggregate operator-supplied observations. Rates require documented denominators and complete cohorts. Missing, invalid, stale or small-cell observations are never presented as zero. The application does not verify the source or collect new events here.</p></section>
 <section className="dashboard-card"><h2>Related reports</h2><p><Link href="/owner-hq/activation" prefetch={false}>Web research diagnostics</Link> · <Link href="/owner-hq/campaigns" prefetch={false}>Campaign attribution</Link></p></section>
 </div></main>;
}
