import { selectActiveCompetitionSeason, type CompetitionSeason } from "./hoopdata-api-sports-competition";
import { reviewedCompetitionMapping, type CompetitionMapping, type CompetitionTask } from "./hoopdata-competition-worker";

export type RefreshClaim={leagueId:string;kind:CompetitionTask["kind"];leaseToken:string;mapping:CompetitionMapping;seasonRows:unknown};
type Outcome={state:"staged"|"deferred"|"failed";retryAt?:string;reason:string};
type WorkerResult={state:string;retryAt?:string|null};
type Dependencies={claim:()=>Promise<RefreshClaim|null>;execute:(task:CompetitionTask,claim:RefreshClaim)=>Promise<WorkerResult>;finish:(claim:RefreshClaim,outcome:Outcome)=>Promise<boolean>;now:()=>Date};
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function activeSeason(rows:unknown,now:Date):CompetitionSeason|null{
  if(!Array.isArray(rows)||rows.length>150||rows.length===0)return null;
  const seasons:CompetitionSeason[]=[];
  for(const raw of rows){
    if(!raw||typeof raw!=="object"||typeof raw.season!=="string"||!(raw.start===null||typeof raw.start==="string")||!(raw.end===null||typeof raw.end==="string")||![true,false,null].includes(raw.standings)||![true,false,null].includes(raw.games))return null;
    seasons.push(raw as CompetitionSeason);
  }
  const season=selectActiveCompetitionSeason(seasons,now.toISOString().slice(0,10));
  const matches=seasons.filter(s=>s.season===season);
  return matches.length===1?matches[0]:null;
}
/** One lease per tick. No retries within the tick; all provider calls must use the durable quota guard. */
export async function runCompetitionRefreshTick(deps:Dependencies){
  const claim=await deps.claim();
  if(!claim)return {state:"idle" as const};
  if(!uuid(claim.leagueId)||!uuid(claim.leaseToken)||!["seasons","games","standings"].includes(claim.kind))return {state:"invalid-claim" as const};
  let outcome:Outcome={state:"failed",reason:"worker-error"};
  try{
    const mapping=claim.mapping;
    if(!mapping||mapping.leagueId!==claim.leagueId||!reviewedCompetitionMapping(mapping))outcome={state:"deferred",reason:"mapping-required"};
    else {
      const season=claim.kind==="seasons"?null:activeSeason(claim.seasonRows,deps.now());
      if(claim.kind!=="seasons"&&(!season||(claim.kind==="standings"?season.standings:season.games)!==true)){
        outcome={state:"deferred",reason:"active-season-or-coverage-unconfirmed"};
      }else{
        const task:CompetitionTask=claim.kind==="seasons"?{kind:"seasons",mapping}:{kind:claim.kind,mapping,season:season!.season};
        const result=await deps.execute(task,claim);
        outcome={state:result.state==="staged"?"staged":["budget-blocked","budget-unavailable","mapping-required","not-configured","rights-blocked"].includes(result.state)?"deferred":"failed",reason:result.state};
        if(typeof result.retryAt==="string"&&Number.isFinite(Date.parse(result.retryAt)))outcome.retryAt=result.retryAt;
      }
    }
  }catch{/* retain failed state and release the lease with backoff */}
  if(await deps.finish(claim,outcome)!==true)return {state:"lease-lost" as const};
  return {...outcome,leagueId:claim.leagueId,kind:claim.kind};
}
