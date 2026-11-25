import { evaluateProviderRights, type RightsGrant } from "./hoopdata-provider-rights";
import { projectAttestedStandings } from "./hoopdata-standings-projection";
type Projection=ReturnType<typeof projectAttestedStandings>;
type Team={id:string;name:string};
export function standingsDisplayRights(leagueId:string,plan:string,grants:readonly RightsGrant[],now:Date,channel:"web-display"|"app-display"="web-display"){
 return evaluateProviderRights({provider:"api-sports",competitionId:leagueId,kind:"standings",use:channel,plan},grants,now);
}
/** Allowlist only reviewed rows with an authorized display window. No ranking recomputation. */
export function licensedStandingsView(projection:Projection,leagueId:string,plan:string,grants:readonly RightsGrant[],teams:readonly Team[],now:Date,channel:"web-display"|"app-display"="web-display"){
 const rights=standingsDisplayRights(leagueId,plan,grants,now,channel);
 if(!rights.allowed||projection.state!=="eligible-for-publication"||projection.leagueId!==leagueId)return null;
 const observed=Date.parse(projection.observedAt),time=now.getTime(),expiry=Math.min(Date.parse(rights.expiresAt),observed+3600000);
 if(!Number.isFinite(observed)||observed>time||expiry<=time||projection.rows.length<1||projection.rows.length>1000)return null;
 const ids=new Set(projection.rows.map(r=>r.teamId)),names=new Map<string,string>();
 for(const t of teams){
  if(!ids.has(t.id)||names.has(t.id)||typeof t.name!=="string"||!t.name.trim()||t.name.length>250)return null;
  names.set(t.id,t.name);
 }
 if(names.size!==ids.size)return null;
 const groups=new Map<string,{stage:string|null;group:string|null;rows:Array<{teamId:string;name:string;position:number;played:number|null;wins:number|null;losses:number|null;pointsFor:number|null;pointsAgainst:number|null}>}>();
 for(const r of projection.rows){
  const key=JSON.stringify([r.stage,r.group]),group=groups.get(key)??{stage:r.stage,group:r.group,rows:[]};
  if(group.rows.some(t=>t.teamId===r.teamId))return null;
  group.rows.push({teamId:r.teamId,name:names.get(r.teamId)!,position:r.position,played:r.played,wins:r.wins,losses:r.losses,pointsFor:r.pointsFor,pointsAgainst:r.pointsAgainst});
  groups.set(key,group);
 }
 return {leagueId,season:projection.season,observedAt:projection.observedAt,expiresAt:new Date(expiry).toISOString(),source:"API-Sports",attribution:rights.attribution,groups:[...groups.values()].map(g=>({...g,rows:g.rows.sort((a,b)=>a.position-b.position)}))};
}
