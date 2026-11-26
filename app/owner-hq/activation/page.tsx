import type {Metadata} from "next";
import Link from "next/link";
import {requireAmbassadorSession} from "../../../lib/ambassador/server";
import {readActivationDiagnostics} from "../../../lib/owner/read-activation-diagnostics";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Signup & activation diagnostics | HoopCheck™",robots:{index:false,follow:false}};
export default async function ActivationDiagnostics(){
 await requireAmbassadorSession("/owner-hq/activation",true);
 const report=await readActivationDiagnostics().catch(()=>({state:"unavailable" as const}));
 return <main className="page-shell"><div className="page-container"><header className="hero-card"><h1>Signup &amp; activation diagnostics</h1><Link href="/owner-hq" prefetch={false}>Back to Owner HQ</Link></header><section className="dashboard-card"><h2>Signup funnel coverage</h2><p>Signup starts, abandonment and confirmation are not instrumented in this report. No conversion percentage is estimated.</p><h2>First-week research observation</h2><p>Counts profiles created in a completed seven-day cohort that recorded at least one qualifying web research page view in their first seven days. Client-reported page views can be incomplete or inaccurate; this is not a verified activation event and excludes native-only activity.</p>
 {report.state==="disabled"?<p role="status">Diagnostics disabled pending data governance review.</p>:report.state==="unavailable"?<p role="status">Report unavailable: cohort too small, bounded data incomplete, or source unavailable.</p>:<><p>UTC cohort: {report.window.start} to {report.window.end} (exclusive).</p><p>Recorded profiles: {report.profiles}</p><p>Profiles with qualifying web research visit: {report.observed??"Suppressed: small cell"}</p></>}
 <p>Only aggregate results are displayed; no individual identifiers, browsing history or private profile content.</p></section></div></main>;
}
