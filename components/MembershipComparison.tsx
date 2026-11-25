"use client";
import { useState, useId } from "react";
import { BILLING_LABELS, PLAN_PERKS, PLAN_PRICES, getListedPlanFit } from "../lib/plan-comparison";
import type { BillingTerm, MembershipAudience, PlanTier } from "../lib/plan-comparison";
import { isAtLeastTier } from "../lib/membership-tier";

export default function MembershipComparison({ audience, currentTier, billingTerm, onSelect, blockedFeature, premiumOnly = false, purchaseDisabled = false, showPlanFit = false }: {
  audience: MembershipAudience; currentTier: PlanTier; billingTerm: BillingTerm;
  onSelect?: (tier: "pro" | "premium") => void; blockedFeature?: string;
  premiumOnly?: boolean; purchaseDisabled?: boolean; showPlanFit?: boolean;
}) {
  const perks = blockedFeature ? PLAN_PERKS[audience].filter(p => p.label === blockedFeature) : PLAN_PERKS[audience];
  const [goal, setGoal] = useState("");
  const goalId = useId();
  const fit = getListedPlanFit(audience, goal, premiumOnly);
  const alreadyCovered = fit !== null && isAtLeastTier(currentTier, fit);
  const premiumExclusive = PLAN_PERKS[audience].filter(p => p.minimum === "premium");
  return <section className="hc-membership-comparison" aria-label={premiumOnly ? "Coach and team manager membership comparison" : audience === "fan" ? "Fan membership comparison" : "Player membership comparison"}>
    <div className="hc-premium-intro">
      <span className="eyebrow">MEMBERSHIP & PERKS</span>
      <h2>Your game. More insight.</h2>
      <p>{premiumOnly ? "The full HoopCheck research membership for coaches and team managers is available with Premium." : audience === "fan" ? "Follow the conversation with Pro. Go deeper with Premium team ratings and reviews across men’s and women’s basketball." : "Research teams, coaches, and leagues with Pro or Premium. Compare the included features before choosing your plan."}</p>
      <div className="hc-premium-highlights">
        <span>◇ Team research</span><span>◉ Community & updates</span><span>✓ Clear plan comparison</span>
      </div>
    </div>
    {showPlanFit && !blockedFeature && <div className="dashboard-card" style={{marginBottom:12}}>
      <h3>Find your plan fit</h3>
      <label htmlFor={goalId}>Which listed benefit matters most to you?</label>
      <select id={goalId} value={goal} onChange={event=>setGoal(event.target.value)} style={{display:"block",width:"100%",marginTop:8}}>
        <option value="">Select a benefit</option>
        <option value="free">I do not need paid features right now</option>
        {PLAN_PERKS[audience].map(perk=><option key={perk.label} value={perk.label}>{perk.label}</option>)}
      </select>
      <div role="status" aria-live="polite" style={{marginTop:10}}>
        {fit === null ? <p>Choose a benefit to compare the lowest listed tier.</p> : alreadyCovered ? <p><strong>Your current tier already meets this listed requirement.</strong> No upgrade is suggested for this choice.</p> : audience === "fan" ? <p><strong>{fit === "premium" ? "Fan Premium" : "Fan Pro"} is the listed match.</strong> Paid fan products are not currently available for purchase.</p> : <p><strong>{fit === "premium" ? "Premium" : "Pro"} is the lowest listed tier for this benefit.</strong> Check your verified billing options below or in your membership management area.</p>}
      </div>
      <small>Based on your selection only. Account role, verification, product availability and existing access rules still apply. Nothing is purchased or changed here.</small>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:12}}>
      {(["free","pro","premium"] as const).filter(tier => !premiumOnly || tier !== "pro").map(tier => <article key={tier} className={currentTier===tier ? "plan-card hc-membership-plan is-current" : "plan-card hc-membership-plan"} >
        <div className="eyebrow">{premiumOnly ? "COACH & TEAM MANAGER" : audience.toUpperCase()} MEMBERSHIP</div>
        <h3>{tier[0].toUpperCase()+tier.slice(1)} {currentTier===tier && <small aria-label="Your current membership">· CURRENT</small>}</h3>
        <p className="price"><strong>{tier==="free" ? "Free" : audience==="fan" ? "Not yet priced" : PLAN_PRICES[tier][billingTerm]}</strong> {tier!=="free" && audience!=="fan" && <span>{BILLING_LABELS[billingTerm]}</span>}</p>
        {tier === "premium" && <p className="hc-plan-difference" style={{fontWeight:700,fontSize:13}}>{premiumExclusive.length ? "Everything in Pro, plus full team ratings and reviews" : "Includes all listed Pro features. No additional exclusive benefits are currently listed for this audience."}</p>}
        <ul style={{listStyle:"none",padding:0}}>
          {perks.map(perk => { const included=isAtLeastTier(tier,perk.minimum);const newlyIncluded=included&&!isAtLeastTier(currentTier,perk.minimum);
            return <li key={perk.label} style={{display:"flex",gap:8,padding:"9px 0",borderBottom:"1px solid var(--hc-border, #7773)",fontWeight:newlyIncluded?700:400}}>
              <span aria-label={included?"Included":"Not included"}>{included?"✓":"—"}</span><span>{perk.label}</span>
            </li>;
          })}
        </ul>
        {onSelect && audience!=="fan" && tier!=="free" && tier!==currentTier && <button type="button" className="btn plan-button" disabled={purchaseDisabled} onClick={()=>onSelect(tier)}>Choose {tier==="pro"?"Pro":"Premium"}</button>}
      </article>)}
    </div>
  </section>;
}
