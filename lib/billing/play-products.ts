/** Proposed Google Play catalog, not approved or provisioned in Play Console.
 * Never expose these reference prices as live purchase offers. */
export const PLAY_PACKAGE="online.hoopcheck.app";
export const PLAY_PRODUCTS=[
 {productId:"hoopcheck.pro",basePlanId:"monthly",plan:"pro",interval:"month",months:1,usdMinor:499},
 {productId:"hoopcheck.pro",basePlanId:"six-month",plan:"pro",interval:"6_month",months:6,usdMinor:2695},
 {productId:"hoopcheck.pro",basePlanId:"annual",plan:"pro",interval:"year",months:12,usdMinor:5090},
 {productId:"hoopcheck.premium",basePlanId:"monthly",plan:"premium",interval:"month",months:1,usdMinor:999},
 {productId:"hoopcheck.premium",basePlanId:"six-month",plan:"premium",interval:"6_month",months:6,usdMinor:5395},
 {productId:"hoopcheck.premium",basePlanId:"annual",plan:"premium",interval:"year",months:12,usdMinor:10190},
] as const;
export type PlayProduct=typeof PLAY_PRODUCTS[number];
export function playProduct(product:unknown,basePlan:unknown):PlayProduct|null{
 return PLAY_PRODUCTS.find(p=>p.productId===product&&p.basePlanId===basePlan)??null;
}
export function canPurchasePlayProduct(role:unknown,product:PlayProduct):boolean{
 return ["player","scout","agent","club_admin"].includes(String(role))||(["coach","manager"].includes(String(role))&&product.plan==="premium");
}
