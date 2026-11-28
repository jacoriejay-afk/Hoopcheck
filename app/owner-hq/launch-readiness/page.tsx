import type {Metadata} from "next";
import Link from "next/link";
import {requireAmbassadorSession} from "../../../lib/ambassador/server";
import {evaluateLaunchPacket,launchGates} from "../../../lib/owner/launch-review";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Launch readiness | HoopCheck™",robots:{index:false,follow:false}};
const gateLabels={technical:"Step 4 technical evidence",store:"Store and signed-build review",privacy_legal:"Privacy and legal review",support_moderation:"Support and moderation capacity",incident_rollback:"Incident response and rollback",tester_consent:"Tester consent and invitation scope",owner_scope:"Owner review of proposed rollout scope"};
export default async function LaunchReadiness(){
 await requireAmbassadorSession("/owner-hq/launch-readiness",true);
 const enabled=process.env.HOOPCHECK_LAUNCH_REVIEW_ENABLED==="true";
 // Use platform-provided commit identity, never a packet's self-declared SHA.
 const decision=evaluateLaunchPacket(enabled?process.env.HOOPCHECK_LAUNCH_REVIEW_JSON:undefined,process.env.VERCEL_GIT_COMMIT_SHA);
 return <main className="page-shell"><div className="page-container" style={{display:"grid",gap:16}}>
 <header className="hero-card"><p className="eyebrow">PRIVATE OWNER WORKSPACE</p><h1>Launch readiness</h1><Link href="/owner-hq" prefetch={false}>Back to Owner HQ</Link></header>
 <section className="dashboard-card"><h2>{decision.state==="HOLD"?"Rollout on hold":"Review packet complete — approval still required"}</h2>
 {!enabled&&<p role="status">Launch review reporting disabled.</p>}
 {decision.stage&&<p>Proposed stage: {decision.stage.replaceAll("_"," ")}</p>}
 <p>{decision.passed.length} of {launchGates.length} evidence entries structurally accepted.</p>
 <p>This page checks the shape, scope and recency of operator-supplied evidence. It does not independently verify links, signatures, incident counts, technical results or approvals. No release action is available here.</p>
 {decision.blocked.length>0&&<ul aria-label="Launch blockers">{decision.blocked.map(reason=><li key={reason}>{reason.replaceAll("_"," ")}</li>)}</ul>}</section>
 <section className="dashboard-card"><h2>Launch review gates</h2><dl>{launchGates.map(gate=><div key={gate}><dt>{gateLabels[gate]}</dt><dd>{decision.passed.includes(gate)?"Packet entry supplied":"Not accepted"}</dd></div>)}</dl>
 <p>Keep distribution paused until an independent reviewer confirms Step 4 and the owner separately authorizes the exact release. Never advance automatically.</p></section>
 <section className="dashboard-card"><h2>Related reports</h2><Link href="/owner-hq/growth" prefetch={false}>Launch growth</Link></section>
 </div></main>;
}
