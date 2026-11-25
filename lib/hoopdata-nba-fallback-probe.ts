import { normalizeBdlGame, type VerifiedAlias } from "./hoopdata-balldontlie";
import { fallbackScoreProposal } from "./hoopdata-fallback";
import { retryAfterTime } from "./hoopdata-provider-fetch";
import { scoreSnapshotFreshness } from "./hoopdata-ingestion";
type Input=Omit<Parameters<typeof fallbackScoreProposal>[0],"fixture"|"observedAt"|"now"> & {
  providerGameId:string; apiKey?:string;
};
type Dependencies={
  reserve:(pool:"balldontlie")=>Promise<boolean>;
  blockUntil:(pool:"balldontlie",until:string)=>Promise<void>;
  fetcher:typeof fetch; now:()=>Date;
};
const maxBytes=256*1024;
export async function boundedBody(response:Response):Promise<unknown>{
  if(!response.body)throw Error("Missing response");
  const reader=response.body.getReader(),decoder=new TextDecoder("utf-8",{fatal:true});
  let size=0,body="";
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>maxBytes)throw Error("Response exceeds limit");
      body+=decoder.decode(value,{stream:true});
    }
    return JSON.parse(body+decoder.decode());
  }finally{try{await reader.cancel();}catch{/* no retry */}reader.releaseLock();}
}
/** NBA-only documented single-fixture endpoint. Produces a proposal, never a canonical write.
 * WNBA single-fixture capability is not assumed. Callers must supply reviewed aliases.
 */
export async function probeNbaFallback(input:Input,deps:Dependencies){
  const {canonical,providerGameId,gameAliases,teamAliases,apiKey}=input;
  const now=deps.now();
  if(canonical.status!=="live")return {state:"not-eligible" as const};
  if(scoreSnapshotFreshness(canonical.score_updated_at,now)==="fresh")return {state:"primary-fresh" as const};
  if(!/^[1-9][0-9]*$/.test(providerGameId)||!Number.isSafeInteger(Number(providerGameId)))return {state:"review-required" as const};
  const matching=gameAliases.filter((a:VerifiedAlias)=>a.provider==="balldontlie-nba"&&a.providerGameId===providerGameId);
  if(matching.length!==1||matching[0].canonicalGameId!==canonical.id)return {state:"review-required" as const};
  if(!apiKey)return {state:"not-configured" as const};
  try{if(await deps.reserve("balldontlie")!==true)return {state:"budget-blocked" as const};}
  catch{return {state:"budget-unavailable" as const};}
  const fail=async(status:number|null,header:string|null)=>{
    if(status!==null&&status!==408&&status!==429&&status<500)return {state:"provider-error" as const,status,retryAt:null};
    const retryAt=retryAfterTime(header,deps.now());
    try{await deps.blockUntil("balldontlie",retryAt);}
    catch{return {state:"budget-unavailable" as const};}
    return {state:"provider-error" as const,status,retryAt};
  };
  let response:Response;
  try{response=await deps.fetcher(new URL("https://api.balldontlie.io/v1/games/"+providerGameId),{
    headers:{Authorization:apiKey,Accept:"application/json"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000),
  });}catch{return fail(null,null);}
  if(!response.ok)return fail(response.status,response.headers.get("Retry-After"));
  try{
    const raw=await boundedBody(response);
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return {state:"invalid-response" as const};
    const fixture=normalizeBdlGame("nba",(raw as Record<string,unknown>).data);
    if(!fixture||fixture.id!==providerGameId)return {state:"invalid-response" as const};
    const observed=deps.now();
    return fallbackScoreProposal({fixture,canonical,gameAliases,teamAliases,observedAt:observed.toISOString(),now:observed});
  }catch{return {state:"invalid-response" as const};}
}
