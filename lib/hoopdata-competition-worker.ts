import { validApiSportsSeason, type CompetitionGame, type CompetitionStanding, type CompetitionSeason } from "./hoopdata-api-sports-competition";
import { fetchCompetitionSnapshot, type CompetitionQuery } from "./hoopdata-competition-fetch";

export type CompetitionMapping = { leagueId: string; providerLeagueId: number; side: "mens" | "womens"; reviewed: boolean; evidence: string };
export type CompetitionTask = { kind: "seasons"; mapping: CompetitionMapping } | { kind: "games" | "standings"; mapping: CompetitionMapping; season: string };
export type CompetitionSnapshot =
  | { kind: "seasons"; mapping: CompetitionMapping; observedAt: string; rows: CompetitionSeason[] }
  | { kind: "games"; mapping: CompetitionMapping; season: string; observedAt: string; rows: CompetitionGame[] }
  | { kind: "standings"; mapping: CompetitionMapping; season: string; observedAt: string; rows: CompetitionStanding[] };
type Result = { state:"staged"; kind:CompetitionTask["kind"]; count:number; observedAt:string } |
  { state:"mapping-required"|"not-configured"|"invalid-task"|"budget-blocked"|"budget-unavailable"|"invalid-response"|"stage-failed" } |
  { state:"provider-error"; status:number|null; retryAt:string|null };
type Dependencies = Parameters<typeof fetchCompetitionSnapshot>[2] & {stage:(snapshot:CompetitionSnapshot)=>Promise<boolean>};

export function reviewedCompetitionMapping(mapping:CompetitionMapping):boolean {
  return mapping.reviewed===true && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mapping.leagueId)
    && Number.isSafeInteger(mapping.providerLeagueId) && mapping.providerLeagueId>0
    && (mapping.side==="mens"||mapping.side==="womens") && typeof mapping.evidence==="string" && mapping.evidence.trim().length>0;
}

/** Reuse HOOPDATA-2A's bounded fetcher; add reviewed canonical identity and staged persistence. */
export async function runCompetitionTask(task:CompetitionTask, apiKey:string|undefined, deps:Dependencies):Promise<Result>{
  if(!reviewedCompetitionMapping(task.mapping))return {state:"mapping-required"};
  if(task.kind!=="seasons"&&(!["games","standings"].includes(task.kind)||!validApiSportsSeason(task.season)))return {state:"invalid-task"};
  const mapping=task.mapping,league=mapping.providerLeagueId;
  const query:CompetitionQuery=task.kind==="seasons"?{endpoint:"leagues",league}:{endpoint:task.kind,league,season:task.season};
  const result=await fetchCompetitionSnapshot(query,apiKey,deps);
  if(result.state==="provider-error")return result;
  if(result.state!=="ok")return {state:result.state==="invalid-query"?"invalid-task":result.state};
  if(!result.rows.length)return {state:"invalid-response"};
  let snapshot:CompetitionSnapshot;
  if(task.kind==="seasons"&&result.endpoint==="leagues")snapshot={kind:"seasons",mapping,observedAt:result.observedAt,rows:result.rows};
  else if(task.kind==="games"&&result.endpoint==="games")snapshot={kind:"games",mapping,season:task.season,observedAt:result.observedAt,rows:result.rows};
  else if(task.kind==="standings"&&result.endpoint==="standings")snapshot={kind:"standings",mapping,season:task.season,observedAt:result.observedAt,rows:result.rows};
  else return {state:"invalid-response"};
  try{if(await deps.stage(snapshot)!==true)return {state:"stage-failed"};}catch{return {state:"stage-failed"};}
  return {state:"staged",kind:task.kind,count:snapshot.rows.length,observedAt:result.observedAt};
}
