import { prepareStandingsForReview } from "./hoopdata-standings-review";
import type { CompetitionStanding } from "./hoopdata-api-sports-competition";

type ReviewInput=Parameters<typeof prepareStandingsForReview>[0];
type Attestation={
  leagueId:string; providerLeagueId:number; season:string; observedAt:string;
  mappingReviewedAt:string; reviewedAt:string; evidence:string;
  snapshotRows:unknown; reviewedRoster:unknown; reviewedTeamIds:unknown;
};
type Input=Omit<ReviewInput,"review"|"maxAgeMs"> & {
  leagueActive:boolean; mappingReviewedAt:string; attestation:Attestation|null;
};
type PublicRow=Omit<CompetitionStanding,"teamId"> & {teamId:string};
type Projection={state:"unavailable"|"review-required"|"stale"|"unsupported"|"incomplete"|"invalid"} |
  {state:"eligible-for-publication"; source:"api-sports-basketball"; leagueId:string; season:string; observedAt:string; rows:PublicRow[]};
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const keys=["teamId","stage","group","position","played","wins","losses","pointsFor","pointsAgainst"] as const;
const exactRow=(a:unknown,b:unknown)=>object(a)&&object(b)&&Object.keys(a).length===keys.length&&Object.keys(b).length===keys.length&&keys.every(k=>Object.hasOwn(a,k)&&Object.hasOwn(b,k)&&a[k]===b[k]);
const stamp=(v:string)=>typeof v==="string"&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v?Date.parse(v):NaN;

/** Server-side candidate projection only. Caller must load current league/team membership,
 * support metadata, mapping, snapshot and operator attestation from one consistent
 * trusted storage read; never accept these objects from a public request.
 * No publication, public grants, provider fetches, or writes occur here. */
export function projectAttestedStandings(input:Input):Projection{
  const {attestation:a,mapping,snapshot,now,mappingReviewedAt}=input;
  if(input.leagueActive!==true||!a)return {state:"unavailable"};
  const time=now.getTime(),observed=stamp(snapshot.observedAt),reviewed=stamp(a.reviewedAt),mapped=stamp(mappingReviewedAt);
  if(![time,observed,reviewed,mapped].every(Number.isFinite)||mapped>observed||reviewed<observed||reviewed>time||
    a.mappingReviewedAt!==mappingReviewedAt||a.leagueId!==snapshot.leagueId||a.providerLeagueId!==snapshot.providerLeagueId||
    a.season!==snapshot.season||a.observedAt!==snapshot.observedAt)return {state:"review-required"};
  if(!Array.isArray(snapshot.rows)||!Array.isArray(a.snapshotRows)||snapshot.rows.length>10000||
    a.snapshotRows.length!==snapshot.rows.length||!snapshot.rows.every((row,i)=>exactRow(row,(a.snapshotRows as unknown[])[i])))return {state:"review-required"};
  if(!Array.isArray(a.reviewedRoster)||a.reviewedRoster.length!==snapshot.rows.length||!object(a.reviewedTeamIds))return {state:"review-required"};
  const groups=new Map<string,{stage:string|null;group:string|null;providerTeamIds:number[]}>();
  for(const entry of a.reviewedRoster){
    if(!object(entry)||!Object.hasOwn(entry,"stage")||!Object.hasOwn(entry,"group")||
      (entry.stage!==null&&typeof entry.stage!=="string")||(entry.group!==null&&typeof entry.group!=="string")||
      typeof entry.teamId!=="number"||!Number.isSafeInteger(entry.teamId)||entry.teamId<=0)return {state:"invalid"};
    const stage=entry.stage as string|null,group=entry.group as string|null,key=JSON.stringify([stage,group]);
    const g=groups.get(key)??{stage,group,providerTeamIds:[]};g.providerTeamIds.push(entry.teamId);groups.set(key,g);
  }
  const checked=prepareStandingsForReview({...input,maxAgeMs:3600000,review:{
    leagueId:a.leagueId,providerLeagueId:a.providerLeagueId,season:a.season,observedAt:a.observedAt,reviewed:true,evidence:a.evidence,groups:[...groups.values()]
  }});
  if(checked.state!=="eligible-for-review")return {state:checked.state};
  const aliases=a.reviewedTeamIds;
  const expectedIds=new Set(checked.rows.map(r=>String(r.teamId)));
  if(Object.keys(aliases).length!==expectedIds.size||checked.rows.some(r=>!Object.hasOwn(aliases,String(r.teamId))||aliases[String(r.teamId)]!==r.canonicalTeamId))return {state:"review-required"};
  return {state:"eligible-for-publication",source:checked.source,leagueId:checked.leagueId,season:checked.season,observedAt:checked.observedAt,
    rows:checked.rows.map(r=>({teamId:r.canonicalTeamId,stage:r.stage,group:r.group,position:r.position,played:r.played,wins:r.wins,losses:r.losses,pointsFor:r.pointsFor,pointsAgainst:r.pointsAgainst}))};
}
