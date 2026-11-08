"use client";
import { BILLING_LABELS, PLAN_PERKS, PLAN_PRICES } from "../lib/plan-comparison";
import type { BillingTerm, MembershipAudience, PlanTier } from "../lib/plan-comparison";
import { isAtLeastTier } from "../lib/membership-tier";

export default function MembershipComparison({ audience, currentTier, billingTerm, onSelect, blockedFeature }: {
  audience: MembershipAudience; currentTier: PlanTier; billingTerm: BillingTerm;
  onSelect?: (tier: "pro" | "premium") => void; blockedFeature?: string;
}) {
  const perks = blockedFeature ? PLAN_PERKS[audience].filter(p => p.label === blockedFeature) : PLAN_PERKS[audience];
  const premiumExclusive = PLAN_PERKS[audience].filter(p => p.minimum === "premium");
  return <section className="hc-membership-comparison" aria-label={audience === "fan" ? "Fan membership comparison" : "Player membership comparison"}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:12}}>
      {(["free","pro","premium"] as const).map(tier => <article key={tier} className={currentTier===tier ? "plan-card hc-membership-plan is-current" : "plan-card hc-membership-plan"} style={{border:currentTier===tier?"2px solid var(--hc-orange, #ff5a1f)":undefined,padding:18}}>
        <div className="eyebrow">{audience.toUpperCase()} MEMBERSHIP</div>
        <h3>{tier[0].toUpperCase()+tier.slice(1)} {currentTier===tier && <small aria-label="Your current membership">· CURRENT</small>}</h3>
        <p className="price"><strong>{tier==="free"?"Free":PLAN_PRICES[tier][billingTerm]}</strong> {tier!=="free" && <span>{BILLING_LABELS[billingTerm]}</span>}</p>
        {tier === "premium" && <p className="hc-plan-difference" style={{fontWeight:700,fontSize:13}}>{premiumExclusive.length ? "Includes Pro features, plus Premium benefits below" : "Includes all Pro features · Premium-only benefits not yet configured"}</p>}
        <ul style={{listStyle:"none",padding:0}}>
          {perks.map(perk => { const included=isAtLeastTier(tier,perk.minimum);const newlyIncluded=included&&!isAtLeastTier(currentTier,perk.minimum);
            return <li key={perk.label} style={{display:"flex",gap:8,padding:"9px 0",borderBottom:"1px solid var(--hc-border, #7773)",fontWeight:newlyIncluded?700:400}}>
              <span aria-label={included?"Included":"Not included"}>{included?"✓":"—"}</span><span>{perk.label}</span>
            </li>;
          })}
        </ul>
        {onSelect && tier!=="free" && tier!==currentTier && <button type="button" className="btn plan-button" onClick={()=>onSelect(tier)}>Choose {tier==="pro"?"Pro":"Premium"}</button>}
      </article>)}
    </div>
  </section>;
}
