export type WorkspaceKind = "owner" | "ambassador";
export type OwnerWorkspace = { kind: "owner"; owner: string; metrics: {label:string;value:string}[];
  stripe: { paidInvoices:number; activeSubscriptions:number|null; grossPaidMinor:number; refundedMinor:number|null;
    incomplete:boolean; subscriptionsIncomplete:boolean; refundsIncomplete:boolean; error?:string } };
type CurrencyTotal = {currency:string;earned:number};
export type AmbassadorWorkspace = { kind:"ambassador"; owner:string; dashboard:{ code:string; active:boolean; status:string; clicks:number; signups:number; conversions:number;
  totals:CurrencyTotal[]; referrals:{id:string;captured_at:string;first_paid_at:string|null;stripe_status:string|null}[];
  commissions:{id:string;currency:string;earnings:number;subscription_plan:string;paid_invoice_at:string;commission_rate_bps:number;status:string}[];
  payouts:{id:string;currency:string;amount_minor:number;status:string;paid_at:string|null;approved_at:string|null}[] } };
export type Workspace = OwnerWorkspace | AmbassadorWorkspace;
export async function readWorkspace(origin:string, token:string, owner:string, kind:WorkspaceKind, signal?:AbortSignal, fetcher:typeof fetch=fetch):Promise<Workspace> {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !token) throw Error("Invalid workspace request.");
  url.pathname="/api/mobile/workspaces";url.searchParams.set("kind",kind);
  const response=await fetcher(url.toString(),{headers:{Authorization:"Bearer "+token},cache:"no-store",redirect:"error",signal});
  if (!response.ok) throw Error(response.status===403 ? "Workspace access could not be verified." : "Workspace unavailable. Try again.");
  const data=await response.json();
  if(data?.owner!==owner || data.kind!==kind) throw Error("Workspace identity could not be verified.");
  if(kind==="owner" && (!Array.isArray(data.metrics)||!data.stripe))throw Error("Invalid workspace data.");
  if(kind==="ambassador" && (!data.dashboard||!["totals","referrals","commissions","payouts"].every(key=>Array.isArray(data.dashboard[key]))))throw Error("Invalid workspace data.");
  return data;
}
