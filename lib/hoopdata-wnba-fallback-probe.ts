import { parseBdlSeasonPage } from "./hoopdata-balldontlie";
import { fallbackScoreProposal } from "./hoopdata-fallback";
import { boundedBody } from "./hoopdata-nba-fallback-probe";
import { retryAfterTime } from "./hoopdata-provider-fetch";
import { scoreSnapshotFreshness } from "./hoopdata-ingestion";
import { evaluateProviderRights, type RightsGrant } from "./hoopdata-provider-rights";
type Input=Omit<Parameters<typeof fallbackScoreProposal>[0],"fixture"|"observedAt"|"now">&{
  providerGameId:string; providerDate:string; season:number; apiKey?:string;
  plan:string; rights:readonly RightsGrant[];
};
type Deps={reserve:(pool:"balldontlie")=>Promise<boolean>;blockUntil:(pool:"balldontlie",until:string)=>Promise<void>;fetcher:typeof fetch;now:()=>Date};
/** Documented WNBA date filter: https://wnba.balldontlie.io/#get-all-games.
 * Caller must supply trusted reviewed provider date/season and rights records.
 * One request at most. No pagination, writes, publication or activation.
 */
export async function probeWnbaFallback(input:Input,deps:Deps){
 const now=deps.now(),{canonical,providerGameId,providerDate,season,gameAliases,teamAliases,apiKey}=input;
 if(canonical.status!=="live"||!Number.isFinite(now.getTime()))return {state:"not-eligible" as const};
 if(scoreSnapshotFreshness(canonical.score_updated_at,now)==="fresh")return {state:"primary-fresh" as const};
 const tip=Date.parse(canonical.scheduled_at||""), day=Date.parse(providerDate+"T00:00:00Z");
 if(!/^[1-9][0-9]*$/.test(providerGameId)||!Number.isSafeInteger(Number(providerGameId))||!/^\d{4}-\d{2}-\d{2}$/.test(providerDate)||!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==providerDate||!Number.isFinite(tip)||Math.abs(day-tip)>48*3600000||!Number.isSafeInteger(season)||season<1900||season>2200)return {state:"review-required" as const};
 const aliases=gameAliases.filter(a=>a.provider==="balldontlie-wnba"&&a.providerGameId===providerGameId);
 if(aliases.length!==1||aliases[0].canonicalGameId!==canonical.id)return {state:"review-required" as const};
 const right=()=>evaluateProviderRights({provider:"balldontlie",competitionId:"wnba",kind:"scores",use:"evaluate",plan:input.plan},input.rights,deps.now());
 if(!right().allowed)return {state:"rights-blocked" as const};
 if(!apiKey)return {state:"not-configured" as const};
 try{if(await deps.reserve("balldontlie")!==true)return {state:"budget-blocked" as const};}catch{return {state:"budget-unavailable" as const};}
 if(!right().allowed)return {state:"rights-blocked" as const};
 const fail=async(status:number|null,header:string|null)=>{
   if(status!==null&&status!==408&&status!==429&&status<500)return {state:"provider-error" as const,status,retryAt:null};
   const retryAt=retryAfterTime(header,deps.now());
   try{await deps.blockUntil("balldontlie",retryAt);}catch{return {state:"budget-unavailable" as const};}
   return {state:"provider-error" as const,status,retryAt};
 };
 const url=new URL("https://api.balldontlie.io/wnba/v1/games");
 url.searchParams.append("dates[]",providerDate);url.searchParams.append("seasons[]",String(season));url.searchParams.set("per_page","100");
 let response:Response;
 try{response=await deps.fetcher(url,{headers:{Authorization:apiKey,Accept:"application/json"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)});}catch{return fail(null,null);}
 if(!response.ok)return fail(response.status,response.headers.get("Retry-After"));
 try{
   const page=parseBdlSeasonPage("wnba",season,await boundedBody(response));
   if(!page||page.nextCursor!==null)return {state:"invalid-response" as const};
   const fixture=page.fixtures.find(f=>f.id===providerGameId);
   if(!fixture)return {state:"review-required" as const};
   if(!right().allowed)return {state:"rights-blocked" as const};
   const observed=deps.now();
   return fallbackScoreProposal({fixture,canonical,gameAliases,teamAliases,observedAt:observed.toISOString(),now:observed});
 }catch{return {state:"invalid-response" as const};}
}
