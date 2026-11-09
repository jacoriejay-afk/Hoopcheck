"use client";
import { BILLING_LABELS, PLAN_PERKS, PLAN_PRICES } from "../lib/plan-comparison";
import type { BillingTerm, MembershipAudience, PlanTier } from "../lib/plan-comparison";
import { isAtLeastTier } from "../lib/membership-tier";

export default function MembershipComparison({ audience, currentTier, billingTerm, onSelect, blockedFeature, premiumOnly = false, purchaseDisabled = false }: {
  audience: MembershipAudience; currentTier: PlanTier; billingTerm: BillingTerm;
  onSelect?: (tier: "pro" | "premium") => void; blockedFeature?: string;
  premiumOnly?: boolean; purchaseDisabled?: boolean;
}) {
  const perks = blockedFeature ? PLAN_PERKS[audience].filter(p => p.label === blockedFeature) : PLAN_PERKS[audience];
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
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:12}}>
      {(["free","pro","premium"] as const).filter(tier => !premiumOnly || tier !== "pro").map(tier => <article key={tier} className={currentTier===tier ? "plan-card hc-membership-plan is-current" : "plan-card hc-membership-plan"} style={{border:currentTier===tier?"2px solid var(--hc-orange, #ff5a1f)":undefined,padding:18}}>
        <div className="eyebrow">{premiumOnly ? "COACH & TEAM MANAGER" : audience.toUpperCase()} MEMBERSHIP</div>
        <h3>{tier[0].toUpperCase()+tier.slice(1)} {currentTier===tier && <small aria-label="Your current membership">· CURRENT</small>}</h3>
        <p className="price"><strong>{tier==="free"?"Free":PLAN_PRICES[tier][billingTerm]}</strong> {tier!=="free" && <span>{BILLING_LABELS[billingTerm]}</span>}</p>
        {tier === "premium" && <p className="hc-plan-difference" style={{fontWeight:700,fontSize:13}}>{premiumExclusive.length ? "Everything in Pro, plus full team ratings and reviews" : "Includes all listed Pro features. No additional exclusive benefits are currently listed for this audience."}</p>}
        <ul style={{listStyle:"none",padding:0}}>
          {perks.map(perk => { const included=isAtLeastTier(tier,perk.minimum);const newlyIncluded=included&&!isAtLeastTier(currentTier,perk.minimum);
            return <li key={perk.label} style={{display:"flex",gap:8,padding:"9px 0",borderBottom:"1px solid var(--hc-border, #7773)",fontWeight:newlyIncluded?700:400}}>
              <span aria-label={included?"Included":"Not included"}>{included?"✓":"—"}</span><span>{perk.label}</span>
            </li>;
          })}
        </ul>
        {onSelect && tier!=="free" && tier!==currentTier && !isAtLeastTier(currentTier,tier) && <button type="button" className="btn plan-button" disabled={purchaseDisabled} onClick={()=>onSelect(tier)}>Choose {tier==="pro"?"Pro":"Premium"}</button>}
        {tier!=="free" && tier!==currentTier && isAtLeastTier(currentTier,tier) && <button type="button" className="btn plan-button" disabled>Included</button>}
      </article>)}
    </div>
  </section>;
}
