import { apiSportsCompetitionUrl, parseApiSportsSeasonGames, parseApiSportsStandings, parseApiSportsCompetitionSeasons, type CompetitionGame, type CompetitionStanding, type CompetitionSeason } from "./hoopdata-api-sports-competition";
import { retryAfterTime } from "./hoopdata-provider-fetch";

export type CompetitionQuery = {endpoint:"leagues";league:number} | {endpoint:"games"|"standings";league:number;season:string};
type Result =
  | {state:"ok";endpoint:"leagues";rows:CompetitionSeason[];observedAt:string}
  | {state:"ok";endpoint:"games";rows:CompetitionGame[];observedAt:string}
  | {state:"ok";endpoint:"standings";rows:CompetitionStanding[];observedAt:string}
  | {state:"invalid-query"|"not-configured"|"budget-blocked"|"budget-unavailable"|"invalid-response"}
  | {state:"provider-error";status:number|null;retryAt:string|null};
type Deps = {
  reserve: (pool:"api-sports-basketball")=>Promise<boolean>;
  blockUntil:(pool:"api-sports-basketball",until:string)=>Promise<void>;
  fetcher:typeof fetch;
  now:()=>Date;
};
const pool="api-sports-basketball" as const;
const maxBytes=4*1024*1024;
async function boundedJson(response:Response):Promise<unknown>{
  if(!response.body)throw Error("No response body");
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
/** One bounded request through the existing shared credential quota. No canonical writes. */
export async function fetchCompetitionSnapshot(query:CompetitionQuery,apiKey:string|undefined,deps:Deps):Promise<Result>{
  if(!apiKey)return {state:"not-configured"};
  let url:URL;
  try{url=apiSportsCompetitionUrl(query.endpoint,query.league,query.endpoint==="leagues"?undefined:query.season);}
  catch{return {state:"invalid-query"};}
  try{if(await deps.reserve(pool)!==true)return {state:"budget-blocked"};}
  catch{return {state:"budget-unavailable"};}
  const failure=async(status:number|null,header:string|null):Promise<Result>=>{
    if(status!==null&&status!==408&&status!==429&&status<500)return {state:"provider-error",status,retryAt:null};
    const retryAt=retryAfterTime(header,deps.now());
    try{await deps.blockUntil(pool,retryAt);}catch{return {state:"budget-unavailable"};}
    return {state:"provider-error",status,retryAt};
  };
  let response:Response;
  try{response=await deps.fetcher(url,{headers:{"x-apisports-key":apiKey,Accept:"application/json"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)});}
  catch{return failure(null,null);}
  if(!response.ok)return failure(response.status,response.headers.get("Retry-After"));
  try{
    const data=await boundedJson(response),observedAt=deps.now().toISOString();
    if(query.endpoint==="leagues"){
      const rows=parseApiSportsCompetitionSeasons(data,query.league);
      return rows===null?{state:"invalid-response"}:{state:"ok",endpoint:"leagues",rows,observedAt};
    }
    if(query.endpoint==="games"){
      const rows=parseApiSportsSeasonGames(data,query.league,query.season);
      return rows===null?{state:"invalid-response"}:{state:"ok",endpoint:"games",rows,observedAt};
    }
    const rows=parseApiSportsStandings(data,query.league,query.season);
    return rows===null?{state:"invalid-response"}:{state:"ok",endpoint:"standings",rows,observedAt};
  }catch{return {state:"invalid-response"};}
}
