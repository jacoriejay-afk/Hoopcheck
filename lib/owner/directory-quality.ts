/** Read-only directory quality derivation. No guessed affiliations, remote logo requests, or writes. */
export type DirectoryIdentity = {id:string;name:string;country:string|null;basketball_type:string|null;logo_url:string|null};
export type DirectoryLeague = DirectoryIdentity & {season:string|null};
export type DirectoryTeam = DirectoryIdentity & {league_id:string|null};
export type DirectoryMembership = {team_id:string;league_id:string;season:string|null};
type ClubEvidence = {name:string;country:string;aliases?:string[]};
type RosterEvidence = {name:string;country:string;season:string;source:string;verifiedAt:string;confidence:string;clubs:ClubEvidence[]};
const arm = (name:string,aliases?:string[]):ClubEvidence=>({name,country:"Armenia",aliases});
const az = (name:string,aliases?:string[]):ClubEvidence=>({name,country:"Azerbaijan",aliases});
export const verifiedRosters: RosterEvidence[] = [{
  name:"Armenian Basketball League A",country:"Armenia",season:"2026-27",
  source:"https://sportaran.com/en/post/probasket-a-league-vozvrashaetsya-v-novom-sezone-vystupyat-10-komand-iz-pyati-stran/",
  verifiedAt:"2026-11-28",confidence:"Announced roster corroborated by opening round",
  clubs:[arm("BC YANGS"),arm("Urartu BC",["BC URARTU"]),arm("BKMA",["BKMA Yerevan","BC BKMA"]),arm("BC HATIS"),arm("BC HAT"),
    {name:"BC CROSSNATION",country:"United States"},{name:"BC PHOENIX PERCEPTION",country:"United States"},
    {name:"BC TBILISI BTB",country:"Georgia"},{name:"Barsy Atyrau",country:"Kazakhstan",aliases:["BC BARSY ATYRAU"]},{name:"BC NOMAD",country:"Kyrgyzstan"}]
},{
  name:"Azerbaijan Basketball League",country:"Azerbaijan",season:"2026-27",
  source:"https://aze.basketball/News/News/abl-klublar-2026-2027-yekun-klublar-abl",
  verifiedAt:"2026-11-28",confidence:"Federation final participant list",
  clubs:[az("Sabah BK",["Sabah"]),az("Landau Lions",["Landau Lions BK"]),az("Gence BC",["Gəncə BK","Ganja BK","Ganja"]),az("Neftchi IK",["Neftçi İK","Neftchi SC"]),az("Ordu IK",["Ordu"]),az("Nakhchivan BK",["Naxçıvan BK","Nakhchivan"]),az("NTD BK",["NTD"]),az("Sumqayit BK",["Sumqayıt BK","Sumgait","Sumgayit"])]
}];
const normalized=(v:string|null)=> (v||"").normalize("NFKD").replace(/\p{M}/gu,"").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu,"");
const identityKey=(row:DirectoryIdentity)=>[normalized(row.country),row.basketball_type,normalized(row.name)].join(":");
function unique<T extends {id:string}>(rows:T[]) {
  const mapped=new Map(rows.map(row=>[row.id,row]));
  if(mapped.size!==rows.length)throw Error("Directory changed during paging; refresh to retry.");
  return mapped;
}
function duplicateGroups(rows:DirectoryIdentity[]) {
  const counts=new Map<string,number>();
  for(const row of rows) {
    const key=identityKey(row);
    counts.set(key,(counts.get(key)||0)+1);
  }
  return [...counts.values()].filter(value=>value>1).length;
}
function absentLogo(row:DirectoryIdentity){return !row.logo_url?.trim();}
function invalidLogo(row:DirectoryIdentity){
  const value=row.logo_url?.trim();
  if(!value)return false;
  if(value.startsWith("/")&&!value.startsWith("//")&&!value.includes("\\"))return false;
  try{const url=new URL(value);return url.protocol!=="https:"||!!url.username||!!url.password;}catch{return true;}
}
export function deriveDirectoryQuality(leagues:DirectoryLeague[],teams:DirectoryTeam[],memberships:DirectoryMembership[]) {
  const leagueById=unique(leagues),teamById=unique(teams);
  const countryLabels=new Set(teams.map(row=>row.country?.trim()).filter(Boolean));
  const currentByLeague=new Map<string,Set<string>>();
  function link(leagueId:string,teamId:string){
    if(!leagueById.has(leagueId)||!teamById.has(teamId))return;
    if(!currentByLeague.has(leagueId))currentByLeague.set(leagueId,new Set());
    currentByLeague.get(leagueId)!.add(teamId);
  }
  for(const team of teams)if(team.league_id)link(team.league_id,team.id);
  for(const row of memberships){
    const league=leagueById.get(row.league_id);
    if(league&&(!league.season||row.season===league.season))link(row.league_id,row.team_id);
  }
  const coverage=leagues.map(league=>{
    const ids=currentByLeague.get(league.id)||new Set<string>();
    const clubs=[...ids].flatMap(id=>{const team=teamById.get(id);return team?[team]:[]});
    const evidence=verifiedRosters.find(row=>league.basketball_type==="mens"&&row.name===league.name&&row.country===league.country&&row.season===league.season);
    const expected=evidence?.clubs||[];
    const matches=(club:DirectoryTeam,e:ClubEvidence)=>normalized(club.country)===normalized(e.country)&&[e.name,...(e.aliases||[])].some(name=>normalized(name)===normalized(club.name));
    const missing=expected.filter(e=>!clubs.some(club=>matches(club,e))).map(e=>e.name);
    const ambiguous=expected.filter(e=>clubs.filter(club=>matches(club,e)).length>1).map(e=>e.name);
    const unexpected=evidence?clubs.filter(club=>!expected.some(e=>matches(club,e))).map(club=>club.name):[];
    return {id:league.id,name:league.name,country:league.country,side:league.basketball_type,season:league.season,actual:clubs.length,evidence,expected:evidence?expected.length:null,missing,unexpected,ambiguous};
  }).sort((a,b)=>Number(!!b.evidence)-Number(!!a.evidence)||(a.country||"").localeCompare(b.country||"")||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  return {countries:countryLabels.size,leagues:leagues.length,teams:teams.length,
    mensTeams:teams.filter(row=>row.basketball_type==="mens").length,womensTeams:teams.filter(row=>row.basketball_type==="womens").length,
    unlinked:teams.filter(row=>!row.league_id).length,
    missingLeagueLogos:leagues.filter(absentLogo).length,missingTeamLogos:teams.filter(absentLogo).length,
    invalidLogoURLs:[...teams,...leagues].filter(invalidLogo).length,
    duplicateTeamGroups:duplicateGroups(teams),duplicateLeagueGroups:duplicateGroups(leagues),
    missingSeason:leagues.filter(row=>!row.season?.trim()).length,
    countryAliasWarnings:[...countryLabels].filter(label=>["Czech Republic","Bosnia & Herzegovina","Chinese Taipei","Mexico City"].includes(label!)).sort(),
    coverage,verifiedLeagueCount:coverage.filter(row=>!!row.evidence).length};
}
