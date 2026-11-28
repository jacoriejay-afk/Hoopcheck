import "server-only";
import {canPurchasePlayProduct,playProduct} from "../../billing/play-products";
import type {createPlayVerificationClient} from "./verification";
type Session={owner:string;sessionId:string;role:string};
/** Approved sandbox storefront selection is server-owned. An arbitrary client
 * currency or profile country cannot select a cheaper regional price. */
export function createPlayCatalogAdapter(p:{enabled:()=>boolean;provider:ReturnType<typeof createPlayVerificationClient>;approvedRegion:(s:Session)=>Promise<string|null>;canStartPlayBilling:(s:Session)=>Promise<boolean>}){
 return async(s:Session)=>{
  if(!p.enabled()||!await p.canStartPlayBilling(s))return [];
  const region=await p.approvedRegion(s);if(!region||! /^[A-Z]{2}$/.test(region)||!p.enabled())return [];
  const rows=await p.provider.readRegionalCatalog(region);
  if(!p.enabled()||!await p.canStartPlayBilling(s)||await p.approvedRegion(s)!==region)return [];
  return rows.filter(row=>{const product=playProduct(row.productId,row.basePlanId);return product!==null&&canPurchasePlayProduct(s.role,product);});
 };
}
