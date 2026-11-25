import { validApiSportsSeason, type CompetitionStanding } from "./hoopdata-api-sports-competition";
import { reviewedCompetitionMapping, type CompetitionMapping } from "./hoopdata-competition-worker";

type Group = { stage:string|null; group:string|null; providerTeamIds:readonly number[] };
type TeamMapping = { leagueId:string; providerLeagueId:number; side:CompetitionMapping["side"]; providerTeamId:number; teamId:string; reviewed:boolean };
type Snapshot = { leagueId:string; providerLeagueId:number; season:string; observedAt:string; rows:readonly CompetitionStanding[] };
type Review = { leagueId:string; providerLeagueId:number; season:string; observedAt:string; reviewed:boolean; evidence:string; groups:readonly Group[] };
type Input = { mapping:CompetitionMapping; snapshot:Snapshot; review:Review; teamMappings:readonly TeamMapping[]; now:Date; maxAgeMs:number; providerStandingsSupported:boolean|null };
type Output = { state:"review-required"|"stale"|"unsupported"|"incomplete"|"invalid" } |
 { state:"eligible-for-review"; source:"api-sports-basketball"; leagueId:string; season:string; observedAt:string; rows:ReadonlyArray<CompetitionStanding & {canonicalTeamId:string}> };

const positive=(v:number)=>Number.isSafeInteger(v)&&v>0;
const uuid=(v:string)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const label=(v:string|null)=>v===null||typeof v==="string"&&v.trim()===v&&v.length>0&&v.length<=250;
const groupKey=(g:{stage:string|null;group:string|null})=>JSON.stringify([g.stage,g.group]);
const nullableCount=(v:number|null)=>v===null||Number.isSafeInteger(v)&&v>=0;
const instant=(v:string)=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v?Date.parse(v):NaN;

/** Pure preparation gate. Eligibility is not publication, authorization, or coverage certification.
 * The review must come from an independently checked full group roster, never derived from the same snapshot.
 * Caller must bind trusted storage identities and revalidate at a transactional publication boundary. */
export function prepareStandingsForReview(input:Input):Output {
  const {mapping,snapshot,review,teamMappings,now,maxAgeMs,providerStandingsSupported}=input;
  if(providerStandingsSupported===false)return {state:"unsupported"};
  if(providerStandingsSupported!==true||!reviewedCompetitionMapping(mapping)||review.reviewed!==true||typeof review.evidence!=="string"||!review.evidence.trim())return {state:"review-required"};
  if(snapshot.leagueId!==mapping.leagueId||snapshot.providerLeagueId!==mapping.providerLeagueId||
    review.leagueId!==snapshot.leagueId||review.providerLeagueId!==snapshot.providerLeagueId||review.season!==snapshot.season||
    review.observedAt!==snapshot.observedAt||!validApiSportsSeason(snapshot.season))return {state:"review-required"};
  const stamp=instant(snapshot.observedAt),current=now.getTime();
  if(!Number.isFinite(stamp)||!Number.isFinite(current)||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<=0||stamp>current)return {state:"invalid"};
  if(current-stamp>maxAgeMs)return {state:"stale"};
  if(!Array.isArray(snapshot.rows)||!snapshot.rows.length||snapshot.rows.length>10000||!Array.isArray(review.groups)||!review.groups.length||review.groups.length>10000)return {state:"incomplete"};
  const expected=new Map<string,Set<number>>();
  let total=0;
  for(const g of review.groups){
    if(!label(g.stage)||!label(g.group)||!Array.isArray(g.providerTeamIds)||!g.providerTeamIds.length||g.providerTeamIds.length>1000)return {state:"invalid"};
    const key=groupKey(g),ids=new Set<number>(g.providerTeamIds);
    if(expected.has(key)||ids.size!==g.providerTeamIds.length||[...ids].some(id=>!positive(id)))return {state:"invalid"};
    total+=ids.size;if(total>10000)return {state:"invalid"};
    expected.set(key,ids);
  }
  if(total!==snapshot.rows.length)return {state:"incomplete"};
  const aliases=new Map<number,string>(),canonicalIds=new Set<string>();
  for(const m of teamMappings){
    if(m.leagueId!==mapping.leagueId||m.providerLeagueId!==mapping.providerLeagueId||m.side!==mapping.side)continue;
    if(!m.reviewed||!positive(m.providerTeamId)||!uuid(m.teamId)||aliases.has(m.providerTeamId)||canonicalIds.has(m.teamId))return {state:"review-required"};
    aliases.set(m.providerTeamId,m.teamId);canonicalIds.add(m.teamId);
  }
  const prepared:Array<CompetitionStanding & {canonicalTeamId:string}>=[];
  for(const r of snapshot.rows){
    if(!label(r.stage)||!label(r.group)||!positive(r.teamId)||!positive(r.position)||
      ![r.played,r.wins,r.losses,r.pointsFor,r.pointsAgainst].every(nullableCount))return {state:"invalid"};
    if(r.played!==null&&((r.wins!==null&&r.wins>r.played)||(r.losses!==null&&r.losses>r.played)||(r.wins!==null&&r.losses!==null&&r.wins+r.losses>r.played)))return {state:"invalid"};
    const ids=expected.get(groupKey(r));if(!ids?.delete(r.teamId))return {state:"incomplete"};
    const canonicalTeamId=aliases.get(r.teamId);if(!canonicalTeamId)return {state:"review-required"};
    // Preserve provider's stage, group, rank (including ties) and unknown statistics without inventing results.
    prepared.push({teamId:r.teamId,stage:r.stage,group:r.group,position:r.position,played:r.played,wins:r.wins,losses:r.losses,pointsFor:r.pointsFor,pointsAgainst:r.pointsAgainst,canonicalTeamId});
  }
  if([...expected.values()].some(ids=>ids.size))return {state:"incomplete"};
  return {state:"eligible-for-review",source:"api-sports-basketball",leagueId:mapping.leagueId,season:snapshot.season,observedAt:snapshot.observedAt,rows:prepared};
}
