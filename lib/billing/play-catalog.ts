import {playProduct} from "./play-products";
export type PlayCatalogRow={productId:string;basePlanId:string;billingPeriod:string;displayPrice:string;currency:string;priceMicros:string};
const periods={monthly:"P1M","six-month":"P6M",annual:"P1Y"} as const;
export function parsePlayCatalog(value:unknown):PlayCatalogRow[]{
 const error=()=>new Error("Google Play catalog is unavailable.");
 if(!Array.isArray(value)||value.length!==6)throw error();
 const seen=new Set<string>();
 return value.map(row=>{
  if(!row||typeof row!=="object"||Array.isArray(row))throw error();
  if(!Object.keys(row).every(k=>["productId","basePlanId","billingPeriod","displayPrice","currency","priceMicros"].includes(k)))throw error();
  const p=playProduct(row.productId,row.basePlanId);
  if(!p||row.billingPeriod!==periods[p.basePlanId]||typeof row.displayPrice!=="string"||!row.displayPrice.trim()||row.displayPrice.length>100||/[\u0000-\u001f\u007f]/.test(row.displayPrice)||typeof row.currency!=="string"||! /^[A-Z]{3}$/.test(row.currency)||typeof row.priceMicros!=="string"||! /^[1-9][0-9]{0,15}$/.test(row.priceMicros))throw error();
  const id=p.productId+":"+p.basePlanId;if(seen.has(id))throw error();seen.add(id);
  return {productId:p.productId,basePlanId:p.basePlanId,billingPeriod:row.billingPeriod,displayPrice:row.displayPrice,currency:row.currency,priceMicros:row.priceMicros};
 });
}
