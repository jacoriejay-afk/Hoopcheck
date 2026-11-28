export type WorkspaceKind = "owner" | "ambassador";
export type OwnerWorkspace = { kind: "owner"; owner: string; metrics: {label:string;value:string}[];
  stripe: { paidInvoices:number; activeSubscriptions:number|null; grossPaidMinor:number; refundedMinor:number|null;
    incomplete:boolean; subscriptionsIncomplete:boolean; refundsIncomplete:boolean; error?:string } };
type CurrencyTotal = {currency:string;earned:number};
type LedgerBreakdown = { attribution_id: string; gross_minor: number; tax_minor: number; fee_minor: number;
  discount_minor: number; adjustment_minor: number };
type Commission = { id: string; currency: string; earnings: number; subscription_plan: string;
  paid_invoice_at: string; commission_rate_bps: number; status: string } & Partial<LedgerBreakdown>;
export type AmbassadorWorkspace = { kind:"ambassador"; owner:string; dashboard:{ code:string; active:boolean; status:string; clicks:number; signups:number; conversions:number;
  totals:CurrencyTotal[]; referrals:{id:string;captured_at:string;first_paid_at:string|null;stripe_status:string|null}[];
  commissions: Commission[];
  payouts:{id:string;currency:string;amount_minor:number;status:string;paid_at:string|null;approved_at:string|null}[] } };
export type Workspace = OwnerWorkspace | AmbassadorWorkspace;
const isRecord=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==="object"&&!Array.isArray(value));
const isText=(value:unknown):value is string=>typeof value==="string";
const nullableText=(value:unknown)=>value===null||isText(value);
const isCount=(value:unknown)=>typeof value==="number"&&Number.isSafeInteger(value)&&value>=0;
const isAmount=(value:unknown)=>typeof value==="number"&&Number.isSafeInteger(value);
const isCurrency=(value:unknown)=>typeof value==="string"&&/^[a-z]{3}$/i.test(value);
const isDate=(value:unknown)=>typeof value==="string"&&Number.isFinite(Date.parse(value));
const nullableDate=(value:unknown)=>value===null||isDate(value);
function rows(value:unknown,check:(row:Record<string,unknown>)=>boolean):boolean{
  return Array.isArray(value)&&value.every(row=>isRecord(row)&&check(row));
}
const breakdownFields = ["attribution_id", "gross_minor", "tax_minor", "fee_minor", "discount_minor", "adjustment_minor"] as const;
function hasBreakdown(row: Record<string, unknown>): row is LedgerBreakdown {
  return isText(row.attribution_id) && row.attribution_id.length > 0 && breakdownFields.slice(1).every(field => isCount(row[field])) &&
    Number.isSafeInteger(Number(row.tax_minor) + Number(row.fee_minor) + Number(row.adjustment_minor));
}

export function commissionBreakdown(commission: Commission) {
  if (!hasBreakdown(commission)) return null;
  return {
    referral: commission.attribution_id.slice(0, 8), gross: commission.gross_minor,
    deductions: commission.tax_minor + commission.fee_minor + commission.adjustment_minor,
    discount: commission.discount_minor,
    status: commission.earnings === 0 && commission.adjustment_minor > 0 ? "Reversed" : commission.status,
  };
}
export function parseWorkspace(input:unknown,owner:string,kind:WorkspaceKind):Workspace{
  if(!isRecord(input)||input.owner!==owner||input.kind!==kind)throw Error("Workspace identity could not be verified.");
  if(kind==="owner"){
    const s=input.stripe;
    if(!rows(input.metrics,row=>isText(row.label)&&isText(row.value))||!isRecord(s)
      ||!isCount(s.paidInvoices)||!(s.activeSubscriptions===null||isCount(s.activeSubscriptions))
      ||!isCount(s.grossPaidMinor)||!(s.refundedMinor===null||isCount(s.refundedMinor))
      ||![s.incomplete,s.subscriptionsIncomplete,s.refundsIncomplete].every(v=>typeof v==="boolean")
      ||(s.error!==undefined&&!isText(s.error)))throw Error("Invalid workspace data.");
  }else{
    const d=input.dashboard;
    if(!isRecord(d)||!isText(d.code)||typeof d.active!=="boolean"||!isText(d.status)
      ||![d.clicks,d.signups,d.conversions].every(isCount)
      ||!rows(d.totals,r=>isCurrency(r.currency)&&isAmount(r.earned))
      ||!rows(d.referrals,r=>isText(r.id)&&isDate(r.captured_at)&&nullableDate(r.first_paid_at)&&nullableText(r.stripe_status))
      ||!rows(d.commissions,r=>isText(r.id)&&isCurrency(r.currency)&&isAmount(r.earnings)&&isText(r.subscription_plan)&&isDate(r.paid_invoice_at)&&isCount(r.commission_rate_bps)&&Number(r.commission_rate_bps)<=10000&&isText(r.status)
        && (breakdownFields.every(field => !Object.hasOwn(r, field)) || hasBreakdown(r)))
      ||!rows(d.payouts,r=>isText(r.id)&&isCurrency(r.currency)&&isAmount(r.amount_minor)&&isText(r.status)&&nullableDate(r.paid_at)&&nullableDate(r.approved_at)))throw Error("Invalid workspace data.");
  }
  return input as unknown as Workspace;
}
export async function readWorkspace(origin:string, token:string, owner:string, kind:WorkspaceKind, signal?:AbortSignal, fetcher:typeof fetch=fetch):Promise<Workspace> {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !token || signal?.aborted) throw Error("Invalid workspace request.");
  url.pathname="/api/mobile/workspaces";url.searchParams.set("kind",kind);
  const response=await fetcher(url.toString(),{headers:{Authorization:"Bearer "+token},cache:"no-store",redirect:"error",signal});
  if (!response.ok) throw Error(response.status===403 ? "Workspace access could not be verified." : "Workspace unavailable. Try again.");
  const payload: unknown = await response.json();
  if (signal?.aborted) throw Error("Workspace request cancelled.");
  return parseWorkspace(payload,owner,kind);
}
