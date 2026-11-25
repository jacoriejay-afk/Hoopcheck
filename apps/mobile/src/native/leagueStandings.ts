export type StandingsSide="mens"|"womens";
export type NativeStanding={teamId:string;name:string;position:number;played:number|null;wins:number|null;losses:number|null;pointsFor:number|null;pointsAgainst:number|null};
export type NativeStandings={leagueId:string;side:StandingsSide;season:string;source:"API-Sports";attribution:string;observedAt:string;expiresAt:string;groups:{stage:string|null;group:string|null;rows:NativeStanding[]}[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validStandingsSeason(s:string){const match=/^(\d{4})(?:-(\d{4}))?$/.exec(s);return !!match&&Number(match[1])>=1900&&Number(match[1])<=2200&&(!match[2]||Number(match[2])===Number(match[1])+1);}
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
const label=(x:unknown):x is string|null=>x===null||(typeof x==="string"&&x.length>0&&x.length<=250);
const number=(x:unknown):x is number|null=>x===null||(typeof x==="number"&&Number.isSafeInteger(x)&&x>=0);
export function isStandingsCurrent(view:NativeStandings,now=Date.now()){const observed=Date.parse(view.observedAt),expiry=Date.parse(view.expiresAt);return Number.isFinite(now)&&Number.isFinite(observed)&&Number.isFinite(expiry)&&observed<=now&&expiry>now&&expiry<=observed+3600000;}
export function parseNativeStandings(value:unknown,leagueId:string,season:string,side:StandingsSide,now=Date.now()):NativeStandings|null{
 if(!record(value)||value.state!=="available"||!record(value.view))return null;
 const v=value.view;
 if(v.leagueId!==leagueId||v.season!==season||v.side!==side||v.source!=="API-Sports"||typeof v.attribution!=="string"||v.attribution.length>2000||typeof v.observedAt!=="string"||typeof v.expiresAt!=="string"||!Array.isArray(v.groups)||v.groups.length<1||v.groups.length>100)return null;
 const view:NativeStandings={leagueId,season,side,source:"API-Sports",attribution:v.attribution,observedAt:v.observedAt,expiresAt:v.expiresAt,groups:[]};
 if(!isStandingsCurrent(view,now))return null;
 let count=0;const groups=new Set<string>();
 for(const g of v.groups){
  if(!record(g)||!label(g.stage)||!label(g.group)||!Array.isArray(g.rows)||g.rows.length<1)return null;
  const key=JSON.stringify([g.stage,g.group]);if(groups.has(key))return null;groups.add(key);
  const rows:NativeStanding[]=[],ids=new Set<string>();
  for(const r of g.rows){
   if(++count>1000||!record(r)||typeof r.teamId!=="string"||!uuid.test(r.teamId)||ids.has(r.teamId)||typeof r.name!=="string"||!r.name.trim()||r.name.length>250||typeof r.position!=="number"||!Number.isSafeInteger(r.position)||r.position<1||!number(r.played)||!number(r.wins)||!number(r.losses)||!number(r.pointsFor)||!number(r.pointsAgainst))return null;
   ids.add(r.teamId);rows.push({teamId:r.teamId,name:r.name,position:r.position,played:r.played,wins:r.wins,losses:r.losses,pointsFor:r.pointsFor,pointsAgainst:r.pointsAgainst});
  }
  view.groups.push({stage:g.stage,group:g.group,rows:rows.sort((a,b)=>a.position-b.position)});
 }
 return view;
}
export async function readNativeStandings(origin:string,leagueId:string,season:string,side:StandingsSide,signal:AbortSignal,request:typeof fetch=fetch):Promise<NativeStandings|null>{
 if(!uuid.test(leagueId)||!validStandingsSeason(season)||!["mens","womens"].includes(side))throw Error("Invalid standings request");
 const url=new URL(origin);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||["hoopcheck.online","www.hoopcheck.online"].includes(url.hostname.toLowerCase()))throw Error("Preview origin required");
 url.pathname="/api/hoopdata/standings-preview";url.searchParams.set("leagueId",leagueId.toLowerCase());url.searchParams.set("season",season);url.searchParams.set("side",side);
 const response=await request(url.toString(),{signal,cache:"no-store",redirect:"error",headers:{Accept:"application/json"}});
 if(response.status===404)return null;
 if(!response.ok)throw Error("Standings unavailable");
 if(Number(response.headers.get("content-length")||0)>1000000)throw Error("Standings response too large");
 const raw=await response.text();if(raw.length>1000000)throw Error("Standings response too large");
 return parseNativeStandings(JSON.parse(raw),leagueId.toLowerCase(),season,side);
}
