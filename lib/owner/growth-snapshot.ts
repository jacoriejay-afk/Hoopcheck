/** Reviewed aggregate launch observations only. No collection, IDs, or implicit estimates. */
export const GROWTH_TARGET=1000;
const DAY=86400000;
const MIN_COHORT=20;
const MAX_AGE=7*DAY;
export const growthRates=["signup_conversion","day7_retention","paid_conversion","referral_conversion"] as const;
type Rate=typeof growthRates[number];
type Counts={numerator:number;denominator:number};
type Snapshot={windowStart:string;windowEnd:string;source:string;coverage:"web_ios_android";weeklyActiveUsers:number|null;rates:Partial<Record<Rate,Counts>>};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const only=(v:Record<string,unknown>,keys:readonly string[])=>Object.keys(v).every(k=>keys.includes(k));
const count=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const date=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d\d-\d\dT00:00:00\.000Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export function parseGrowthSnapshot(raw:string|undefined,now=Date.now()):Snapshot|null{
 if(!raw||raw.length>4096||!Number.isFinite(now))return null;
 try{
  const v:unknown=JSON.parse(raw);
  if(!record(v)||!only(v,["windowStart","windowEnd","source","coverage","weeklyActiveUsers","rates"])||
   !date(v.windowStart)||!date(v.windowEnd)||Date.parse(v.windowEnd)-Date.parse(v.windowStart)!==7*DAY||
   Date.parse(v.windowEnd)>now||now-Date.parse(v.windowEnd)>MAX_AGE||
   typeof v.source!=="string"||!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/.test(v.source)||
   v.coverage!=="web_ios_android"||(v.weeklyActiveUsers!==null&&!count(v.weeklyActiveUsers))||
   !record(v.rates)||!only(v.rates,growthRates))return null;
  const rates:Snapshot["rates"]={};
  for(const metric of growthRates){
   const c=v.rates[metric];if(c===undefined)continue;
   if(!record(c)||!only(c,["numerator","denominator"])||!count(c.numerator)||!count(c.denominator)||c.numerator>c.denominator)return null;
   rates[metric]={numerator:c.numerator,denominator:c.denominator};
  }
  return {windowStart:v.windowStart,windowEnd:v.windowEnd,source:v.source,coverage:v.coverage,weeklyActiveUsers:v.weeklyActiveUsers,rates};
 }catch{return null;}
}
export function growthSummary(snapshot:Snapshot|null){
 const active=snapshot?.weeklyActiveUsers??null;
 // Do not reveal tiny cohorts or complementary small cells.
 const weeklyActiveUsers=active!==null&&active>=MIN_COHORT?active:null;
 return {weeklyActiveUsers,remaining:weeklyActiveUsers===null?null:Math.max(0,GROWTH_TARGET-weeklyActiveUsers),progress:weeklyActiveUsers===null?null:Math.min(100,100*weeklyActiveUsers/GROWTH_TARGET),
 rates:growthRates.map(metric=>{
  const c=snapshot?.rates[metric];
  return {metric,percent:c&&c.denominator>=MIN_COHORT&&c.numerator>=10&&c.denominator-c.numerator>=10?100*c.numerator/c.denominator:null};
 })};
}
