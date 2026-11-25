import { apiSportsCompetitionUrl, parseApiSportsCompetitionSeasons, parseApiSportsSeasonGames, parseApiSportsStandings, validApiSportsSeason, type CompetitionGame, type CompetitionStanding, type CompetitionSeason } from "./hoopdata-api-sports-competition";
import { retryAfterTime } from "./hoopdata-provider-fetch";

export type CompetitionMapping = { leagueId: string; providerLeagueId: number; side: "mens" | "womens"; reviewed: boolean; evidence: string };
export type CompetitionTask = { kind: "seasons"; mapping: CompetitionMapping } | { kind: "games" | "standings"; mapping: CompetitionMapping; season: string };
export type CompetitionSnapshot =
  | { kind: "seasons"; mapping: CompetitionMapping; observedAt: string; rows: CompetitionSeason[] }
  | { kind: "games"; mapping: CompetitionMapping; season: string; observedAt: string; rows: CompetitionGame[] }
  | { kind: "standings"; mapping: CompetitionMapping; season: string; observedAt: string; rows: CompetitionStanding[] };
type Result = { state:"staged"; kind:CompetitionTask["kind"]; count:number; observedAt:string } |
  { state:"mapping-required"|"not-configured"|"invalid-task"|"budget-blocked"|"budget-unavailable"|"invalid-response"|"stage-failed" } |
  { state:"provider-error"; status:number|null; retryAt:string|null };
type Dependencies = { reserve:()=>Promise<boolean>; blockUntil:(retryAt:string)=>Promise<void>; stage:(snapshot:CompetitionSnapshot)=>Promise<boolean>; fetcher:typeof fetch; now:()=>Date };

export function reviewedCompetitionMapping(mapping:CompetitionMapping):boolean {
  return mapping.reviewed===true && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mapping.leagueId)
    && Number.isSafeInteger(mapping.providerLeagueId) && mapping.providerLeagueId>0
    && (mapping.side==="mens"||mapping.side==="womens") && typeof mapping.evidence==="string" && mapping.evidence.trim().length>0;
}

/** Exactly one bounded provider request for one reviewed competition. No canonical writes. */
export async function runCompetitionTask(task:CompetitionTask, apiKey:string|undefined, deps:Dependencies):Promise<Result>{
  if(!reviewedCompetitionMapping(task.mapping))return {state:"mapping-required"};
  if(!apiKey)return {state:"not-configured"};
  if(task.kind!=="seasons"&&(!["games","standings"].includes(task.kind)||!validApiSportsSeason(task.season)))return {state:"invalid-task"};
  const url=apiSportsCompetitionUrl(task.kind==="seasons"?"leagues":task.kind,task.mapping.providerLeagueId,task.kind==="seasons"?undefined:task.season);
  try{if(await deps.reserve()!==true)return {state:"budget-blocked"};}catch{return {state:"budget-unavailable"};}
  const failed=async(status:number|null,header:string|null):Promise<Result>=>{
    if(status!==null&&status!==408&&status!==429&&status<500)return {state:"provider-error",status,retryAt:null};
    const retryAt=retryAfterTime(header,deps.now());
    try{await deps.blockUntil(retryAt);}catch{return {state:"budget-unavailable"};}
    return {state:"provider-error",status,retryAt};
  };
  let response:Response;
  try{response=await deps.fetcher(url,{headers:{"x-apisports-key":apiKey,Accept:"application/json"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)});}catch{return failed(null,null);}
  if(!response.ok)return failed(response.status,response.headers.get("Retry-After"));
  let payload:unknown;
  try{payload=await response.json();}catch{return {state:"invalid-response"};}
  const observedAt=deps.now().toISOString(),mapping=task.mapping,providerId=mapping.providerLeagueId;
  let snapshot:CompetitionSnapshot;
  if(task.kind==="seasons"){
    const rows=parseApiSportsCompetitionSeasons(payload,providerId);if(!rows?.length)return {state:"invalid-response"};
    snapshot={kind:"seasons",mapping,observedAt,rows};
  }else if(task.kind==="games"){
    const rows=parseApiSportsSeasonGames(payload,providerId,task.season);if(!rows?.length)return {state:"invalid-response"};
    snapshot={kind:"games",mapping,season:task.season,observedAt,rows};
  }else{
    const rows=parseApiSportsStandings(payload,providerId,task.season);if(!rows?.length)return {state:"invalid-response"};
    snapshot={kind:"standings",mapping,season:task.season,observedAt,rows};
  }
  // Empty/invalid provider snapshots never replace the last usable snapshot.
  try{if(await deps.stage(snapshot)!==true)return {state:"stage-failed"};}catch{return {state:"stage-failed"};}
  return {state:"staged",kind:task.kind,count:snapshot.rows.length,observedAt};
}
