import type { BdlFixture } from "./hoopdata-balldontlie";
import { resolveExistingCanonicalGame, type VerifiedAlias } from "./hoopdata-balldontlie";
import { scoreSnapshotFreshness } from "./hoopdata-ingestion";

type TeamAlias = { provider: BdlFixture["provider"]; providerTeamId: string; canonicalTeamId: string };
type Canonical = {
  id:string; team_id:string; opponent_team_id:string|null; scheduled_at:string|null;
  status:string; score_updated_at:string|null; home_score:number|null; away_score:number|null;
};
type Proposal = { state:"review-required" | "primary-fresh" | "not-eligible" } |
  {state:"candidate";canonicalGameId:string;homeScore:number;awayScore:number;observedAt:string};
const resolveTeam=(fixture:BdlFixture,teamId:string,aliases:readonly TeamAlias[])=>{
  const matches=aliases.filter(a=>a.provider===fixture.provider&&a.providerTeamId===teamId);
  return matches.length===1?matches[0].canonicalTeamId:null;
};
/** A fallback score proposal, not a write. Never change schedule, lifecycle, final state or chat identity. */
export function fallbackScoreProposal(input:{fixture:BdlFixture;canonical:Canonical;gameAliases:readonly VerifiedAlias[];teamAliases:readonly TeamAlias[];observedAt:string;now:Date}):Proposal {
  const {fixture,canonical,gameAliases,teamAliases,observedAt,now}=input;
  if(resolveExistingCanonicalGame(fixture,gameAliases)!==canonical.id)return {state:"review-required"};
  if(canonical.status!=="live"||fixture.status!=="live"||fixture.homeScore===null||fixture.awayScore===null)return {state:"not-eligible"};
  if(scoreSnapshotFreshness(canonical.score_updated_at,now)==="fresh")return {state:"primary-fresh"};
  if(scoreSnapshotFreshness(observedAt,now)!=="fresh")return {state:"not-eligible"};
  const home=resolveTeam(fixture,fixture.homeProviderId,teamAliases),away=resolveTeam(fixture,fixture.awayProviderId,teamAliases);
  if(!home||!away||home===away||!canonical.opponent_team_id||!canonical.scheduled_at||!fixture.tipoff||Date.parse(canonical.scheduled_at)!==Date.parse(fixture.tipoff))return {state:"review-required"};
  const forward=canonical.team_id===home&&canonical.opponent_team_id===away;
  const reverse=canonical.team_id===away&&canonical.opponent_team_id===home;
  if(!forward&&!reverse)return {state:"review-required"};
  const h=forward?fixture.homeScore:fixture.awayScore,a=forward?fixture.awayScore:fixture.homeScore;
  // Corrections can reduce a score; require review rather than overwriting across providers.
  if((canonical.home_score!==null&&h<canonical.home_score)||(canonical.away_score!==null&&a<canonical.away_score))return {state:"review-required"};
  return {state:"candidate",canonicalGameId:canonical.id,homeScore:h,awayScore:a,observedAt};
}
