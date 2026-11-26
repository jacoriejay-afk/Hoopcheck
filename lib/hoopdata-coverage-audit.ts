import { reviewedCompetitionMapping, type CompetitionMapping } from "./hoopdata-competition-worker";
import { selectActiveCompetitionSeason, type CompetitionSeason } from "./hoopdata-api-sports-competition";
import { evaluateProviderRights, type RightsGrant } from "./hoopdata-provider-rights";
type League={id:string;side:"mens"|"womens";active:boolean};
type Observation={leagueId:string;providerLeagueId:number;season:string;kind:"games"|"standings";observedAt:string;rowCount:number};
type SeasonEvidence={leagueId:string;providerLeagueId:number;observedAt:string;rows:readonly CompetitionSeason[]};
type Mapping=CompetitionMapping&{reviewedAt:string};
type Input={leagues:readonly League[];mappings:readonly Mapping[];seasons:readonly SeasonEvidence[];observations:readonly Observation[];rights:readonly RightsGrant[];plan:string;now:Date};
type State="unmapped"|"mapping-review-required"|"season-unverified"|"unsupported"|"support-unconfirmed"|"no-observation"|"stale-observation"|"rights-unconfirmed"|"observed-not-certified";
type Endpoint={state:State;observedAt:string|null;rowCount:number|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable=(state:State):Endpoint=>({state,observedAt:null,rowCount:null});
const stamp=(v:string)=>typeof v==="string"&&Number.isFinite(Date.parse(v))?Date.parse(v):NaN;
const recent=(v:string,now:number,age:number,min:number)=>{const t=stamp(v);return Number.isFinite(t)&&t<=now&&t>=min&&now-t<=age;};
/** Private audit of trusted stored evidence, never a coverage certification or a runtime authorization.
 * Only API-Sports is evaluated here; another provider needs independently reviewed identities.
 * No requests, writes, implicit provider matching, or public data exposure.
 */
export function auditLeagueCoverage(input:Input){
 const now=input.now.getTime();
 if(!Number.isFinite(now)||input.leagues.length>10000)throw Error("Invalid coverage audit input");
 const seen=new Set<string>();
 return input.leagues.filter(l=>l.active===true).map(l=>{
  if(!uuid.test(l.id)||!["mens","womens"].includes(l.side)||seen.has(l.id))throw Error("Invalid league identity");seen.add(l.id);
  const base={leagueId:l.id,side:l.side,source:"api-sports-basketball" as const};
  const fail=(state:State)=>({...base,season:null,fixtures:unavailable(state),standings:unavailable(state)});
  const mappings=input.mappings.filter(m=>m.leagueId===l.id);
  if(!mappings.length)return fail("unmapped");
  const m=mappings[0],mapped=stamp(m.reviewedAt);
  if(mappings.length!==1||!reviewedCompetitionMapping(m)||m.side!==l.side||!Number.isFinite(mapped)||mapped>now||input.mappings.filter(x=>x.providerLeagueId===m.providerLeagueId).length!==1)return fail("mapping-review-required");
  const evidence=input.seasons.filter(s=>s.leagueId===l.id&&s.providerLeagueId===m.providerLeagueId);
  if(evidence.length!==1||!recent(evidence[0].observedAt,now,86400000,mapped)||!Array.isArray(evidence[0].rows)||evidence[0].rows.length>150)return fail("season-unverified");
  const season=selectActiveCompetitionSeason(evidence[0].rows,input.now.toISOString().slice(0,10));
  const matches=evidence[0].rows.filter(s=>s.season===season);
  if(!season||matches.length!==1)return fail("season-unverified");
  const evaluate=(kind:"games"|"standings"):Endpoint=>{
   const support=matches[0][kind];
   if(support===false)return unavailable("unsupported");
   if(support!==true)return unavailable("support-unconfirmed");
   const observed=input.observations.filter(o=>o.leagueId===l.id&&o.providerLeagueId===m.providerLeagueId&&o.season===season&&o.kind===kind);
   if(observed.length!==1||!Number.isSafeInteger(observed[0].rowCount)||observed[0].rowCount<1||observed[0].rowCount>10000)return unavailable("no-observation");
   const o=observed[0];
   if(!recent(o.observedAt,now,kind==="games"?86400000:3600000,mapped))return unavailable("stale-observation");
   const permitted=evaluateProviderRights({provider:"api-sports",competitionId:l.id,kind:kind==="games"?"fixtures":"standings",use:"web-display",plan:input.plan},input.rights,input.now);
   return {state:permitted.allowed?"observed-not-certified":"rights-unconfirmed",observedAt:o.observedAt,rowCount:o.rowCount};
  };
  return {...base,season,fixtures:evaluate("games"),standings:evaluate("standings")};
 });
}
