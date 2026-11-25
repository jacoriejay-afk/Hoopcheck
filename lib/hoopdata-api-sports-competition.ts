import { providerTipoff, validatedProviderScore } from "./hoopdata-ingestion";

type Obj = Record<string, unknown>;
const obj = (v:unknown):Obj|null => v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Obj:null;
const uint=(v:unknown):number|null=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0?v:null;
const positive=(v:unknown):number|null=>{const n=uint(v);return n!==null&&n>0?n:null;};
const text=(v:unknown):string|null=>typeof v==="string"&&v.trim()&&v.length<=250?v.trim():null;
export function validApiSportsSeason(season:string):boolean {
  if(!/^[0-9]{4}(?:-[0-9]{4})?$/.test(season))return false;
  const [a,b]=season.split("-").map(Number);
  return a>=1900&&a<=2200&&(b===undefined||b===a+1&&b<=2200);
}
export function apiSportsCompetitionUrl(endpoint:"leagues"|"games"|"standings",league:number,season:string):URL{
  if(!positive(league)||!validApiSportsSeason(season)||!["leagues","games","standings"].includes(endpoint))throw Error("Invalid competition query");
  const url=new URL("https://v1.basketball.api-sports.io/"+endpoint);
  url.searchParams.set(endpoint==="leagues"?"id":"league",String(league));url.searchParams.set("season",season);
  if(endpoint==="games")url.searchParams.set("timezone","UTC");
  return url;
}
function envelope(value:unknown,endpoint:string):unknown[]|null{
  const p=obj(value);
  if(!p||p.get!==endpoint||!Array.isArray(p.response)||p.response.length>10000||p.results!==p.response.length)return null;
  const errors=p.errors;
  if(!(Array.isArray(errors)&&errors.length===0)&&!(obj(errors)&&Object.keys(obj(errors)!).length===0))return null;
  return p.response;
}
export type CompetitionGame={id:number;leagueId:number;season:string;homeId:number;awayId:number;tipoff:string|null;status:string;homeScore:number|null;awayScore:number|null;stage:string|null};
export function parseApiSportsSeasonGames(value:unknown,league:number,season:string):CompetitionGame[]|null{
  const rows=envelope(value,"games");if(!rows||!validApiSportsSeason(season)||!positive(league))return null;
  const seen=new Set<number>(),result:CompetitionGame[]=[];
  for(const value of rows){
    const g=obj(value),l=obj(g?.league),teams=obj(g?.teams),h=positive(obj(teams?.home)?.id),a=positive(obj(teams?.away)?.id),id=positive(g?.id);
    if(!g||!id||!h||!a||h===a||seen.has(id)||l?.id!==league||l.season!==season)return null;
    seen.add(id);
    const raw=text(obj(g.status)?.short);
    const status=raw&&["Q1","Q2","Q3","Q4","OT","BT","HT"].includes(raw)?"live":raw==="NS"||raw==="TBD"?"scheduled":raw==="FT"||raw==="AOT"||raw==="AWD"?"final":raw==="POST"||raw==="SUSP"?"postponed":raw==="CANC"?"cancelled":raw==="ABD"?"abandoned":"unknown";
    const scores=obj(g.scores),withScores=status==="live"||status==="final";
    const hs=withScores?validatedProviderScore(obj(scores?.home)?.total):null,as=withScores?validatedProviderScore(obj(scores?.away)?.total):null;
    if(status==="final"&&(hs===null||as===null||hs===as))return null;
    result.push({id,leagueId:league,season,homeId:h,awayId:a,tipoff:providerTipoff(g.timestamp,g.date),status,homeScore:hs,awayScore:as,stage:text(g.stage)});
  }
  return result;
}
export type CompetitionStanding={teamId:number;stage:string|null;group:string|null;position:number;played:number|null;wins:number|null;losses:number|null;pointsFor:number|null;pointsAgainst:number|null};
export function parseApiSportsStandings(value:unknown,league:number,season:string):CompetitionStanding[]|null{
  const groups=envelope(value,"standings");if(!groups||!validApiSportsSeason(season)||!positive(league))return null;
  const result:CompetitionStanding[]=[],seen=new Set<string>();
  for(const group of groups){
    if(!Array.isArray(group)||group.length>1000)return null;
    for(const value of group){
      const r=obj(value),l=obj(r?.league),id=positive(obj(r?.team)?.id),position=positive(r?.position);
      if(!r||!id||!position||l?.id!==league||l.season!==season)return null;
      const stage=text(r.stage),name=text(obj(r.group)?.name);
      const key=JSON.stringify([stage,name,id]);if(seen.has(key))return null;seen.add(key);
      const games=obj(r.games),points=obj(r.points);
      result.push({teamId:id,stage,group:name,position,played:uint(games?.played),wins:uint(obj(games?.win)?.total),losses:uint(obj(games?.lose)?.total),pointsFor:uint(points?.for),pointsAgainst:uint(points?.against)});
      if(result.length>10000)return null;
    }
  }
  return result;
}
export type CompetitionSeason={season:string;start:string|null;end:string|null;standings:boolean|null;games:boolean|null};
const day=(v:unknown):string|null=>typeof v==="string"&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v?v:null;
/** Preserve actual provider season metadata. No automatic inference from the calendar year. */
export function parseApiSportsCompetitionSeasons(value:unknown,league:number):CompetitionSeason[]|null{
  const rows=envelope(value,"leagues");if(!rows||rows.length!==1||!positive(league))return null;
  const row=obj(rows[0]);if(row?.id!==league||!Array.isArray(row.seasons)||row.seasons.length>150)return null;
  const seen=new Set<string>(),result:CompetitionSeason[]=[];
  for(const value of row.seasons){
    const s=obj(value),season=typeof s?.season==="number"?String(s.season):s?.season;
    if(typeof season!=="string"||!validApiSportsSeason(season)||seen.has(season))return null;seen.add(season);
    const coverage=obj(s?.coverage),start=day(s?.start),end=day(s?.end);
    if(start&&end&&start>end)return null;
    result.push({season,start,end,standings:typeof coverage?.standings==="boolean"?coverage.standings:null,games:typeof coverage?.games==="boolean"?coverage.games:null});
  }
  return result;
}
