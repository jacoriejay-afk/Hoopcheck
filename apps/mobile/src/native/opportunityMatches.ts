/** Match only consent-filtered directory rows already returned by the username search.
 * Self-listed availability is not a verified job offer. No sensitive traits or inferred attributes. */
export type OpportunityCriteria={position:string;minimumYears:string;verifiedOnly:boolean};
type Candidate={free_agent?:boolean|null;position?:string|null;years_pro?:number|null;player_verified?:boolean|null};
export const emptyOpportunityCriteria:OpportunityCriteria={position:"",minimumYears:"",verifiedOnly:false};
export function opportunityMatches<T extends Candidate>(rows:readonly T[],criteria:OpportunityCriteria){
 const position=criteria.position.trim().toLowerCase();
 const years=criteria.minimumYears.trim();
 if(position.length>30||years!==""&&(!/^\d{1,2}$/.test(years)||Number(years)>50))return [];
 return rows.filter(row=>row.free_agent===true&&(!position||typeof row.position==="string"&&row.position.trim().toLowerCase()===position)&&(!years||typeof row.years_pro==="number"&&Number.isSafeInteger(row.years_pro)&&row.years_pro>=Number(years))&&(!criteria.verifiedOnly||row.player_verified===true));
}
export function matchExplanation(criteria:OpportunityCriteria){
 return ["Self-listed availability",criteria.position.trim()?"Position: "+criteria.position.trim():null,criteria.minimumYears.trim()?"Listed experience: "+criteria.minimumYears.trim()+"+ years":null,criteria.verifiedOnly?"Verified professional player":null].filter((s):s is string=>s!==null).join(" · ");
}
