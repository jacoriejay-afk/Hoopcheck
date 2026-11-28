/** Read-only directory quality derivation. No guessed affiliations, remote logo requests, or writes. */
export type DirectoryIdentity = {id:string;name:string;country:string|null;basketball_type:string|null;logo_url:string|null};
export type DirectoryLeague = DirectoryIdentity & {season:string|null};
export type DirectoryTeam = DirectoryIdentity & {league_id:string|null};
export type DirectoryMembership = {team_id:string;league_id:string;season:string|null};
type ClubEvidence = {name:string;country:string;aliases?:string[]};
type RosterEvidence = {name:string;country:string;season:string;side?:'mens'|'womens';leagueAliases?:string[];source:string;verifiedAt:string;confidence:string;clubs:ClubEvidence[]};
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
},{
  name:"Kosovo Superleague",country:"Kosovo",season:"2026-27",
  source:"https://kosovo.basketball/Shooter/Competition/25?name=GRUPI+01",
  verifiedAt:"2026-11-28",confidence:"Federation round-ten fixtures enumerate all eight clubs; federation membership directory distinguishes Bora and Borea",
  clubs:[
    {name:"KB Bora",country:"Kosovo",aliases:["Bora","Bora Basketball"]},
    {name:"KB Rahoveci 029",country:"Kosovo",aliases:["Rahoveci 029"]},
    {name:"KB Bashkimi",country:"Kosovo",aliases:["BC Bashkimi","Bashkimi Prizren","Bashkimi"]},
    {name:"KB Peja",country:"Kosovo",aliases:["Peja"]},
    {name:"KB Sigal Prishtina",country:"Kosovo",aliases:["Sigal Prishtina"]},
    {name:"KB Trepça",country:"Kosovo",aliases:["BC Trepça","Trepça"]},
    {name:"Golden Eagle Ylli",country:"Kosovo",aliases:["KB Ylli","Ylli","KB Golden Eagle Ylli"]},
    {name:"KB Vëllaznimi",country:"Kosovo",aliases:["Vëllaznimi Gjakovë","Vëllaznimi"]}
  ]
},{
  name:"Superleague",country:"Georgia",season:"2026-27",
  source:"https://www.blackfortress.ge/",
  verifiedAt:"2026-11-28",confidence:"Provisional: current club schedules and secondary standings list 11; one secondary roster labels Mega instead of Margveti. Federation-wide identity confirmation pending",
  clubs:[
    {name:"BC Kavkasia",country:"Georgia",aliases:["CIU","BC CIU","CIU Basketball Club","Kavkasia"]},
    {name:"BC Rustavi",country:"Georgia",aliases:["Rustavi"]},
    {name:"BC Orbi",country:"Georgia",aliases:["Orbi","Tkibuli Orbi"]},
    {name:"Telavi",country:"Georgia"},{name:"TSU Tbilisi",country:"Georgia",aliases:["TSU","BC TSU"]},
    {name:"Akhaltsikhe",country:"Georgia"},{name:"BC Batumi 2010",country:"Georgia",aliases:["Batumi","Batumi 2010"]},
    {name:"Kutaisi 2010",country:"Georgia",aliases:["Kutaisi"]},{name:"Iverioni",country:"Georgia"},
    {name:"Margveti",country:"Georgia",aliases:["BC Margveti"]},{name:"Black Fortress",country:"Georgia"}
  ]
},{
  name:"Bónus deild karla",country:"Iceland",season:"2026-27",side:"mens",leagueAliases:["Úrvalsdeild karla"],
  source:"https://www.kki.is/frettir/frett/2026/10/02/Spa-formanna-fyrirlida-og-thjalfara-Bonusdeildar-karla-/",
  verifiedAt:"2026-11-28",confidence:"Federation preseason participant list",
  clubs:["Álftanes","Tindastóll","KR","Grindavík","Stjarnan","Keflavík","Valur","Njarðvík","ÍR","Höttur","Sindri","Ármann"].map(name=>({name,country:"Iceland",aliases:name==="KR"?["KR Reykjavík"]:name==="ÍR"?["ÍR Reykjavík"]:[]}))
},{
  name:"Bónus deild kvenna",country:"Iceland",season:"2026-27",side:"womens",leagueAliases:["Úrvalsdeild kvenna"],
  source:"https://www.kki.is/frettir/frett/2026/09/25/Spa-formanna-fyrirlida-og-thjalfara-Bonusdeildar-kvenna/",
  verifiedAt:"2026-11-28",confidence:"Federation preseason participant list, corroborated by all five opening-round pairings",
  clubs:["Njarðvík","Grindavík","KR","Haukar","Tindastóll","Keflavík","Valur","Stjarnan","Ármann","Fjölnir"].map(name=>({name,country:"Iceland"}))
},{
  name:"WNBL",country:"Australia",season:"2026-27",side:"womens",
  source:"https://www.wnbl.com.au/news/wnbl-annouces-expasion-with-tasmania",
  verifiedAt:"2026-11-28",confidence:"Official nine-team expansion; current WNBL27 fixtures and roster lists corroborate identities",
  clubs:[
    {name:"Adelaide Lightning",country:"Australia"},{name:"Bendigo Spirit",country:"Australia"},
    {name:"UC Capitals",country:"Australia",aliases:["Canberra Capitals","University of Canberra Capitals"]},
    {name:"Geelong Venom",country:"Australia",aliases:["Geelong United"]},
    {name:"Perth Lynx",country:"Australia"},{name:"Southside Melbourne Flyers",country:"Australia",aliases:["Southside Flyers"]},
    {name:"Sydney Flames",country:"Australia"},{name:"Tasmania Jewels",country:"Australia"},{name:"Townsville Fire",country:"Australia"}
  ]
},{
  name:"Liga Betclic",country:"Portugal",season:"2026-27",side:"mens",leagueAliases:["Liga Betclic Masculina"],
  source:"https://www.fpb.pt/noticia/o-arranque-de-2026-2027-sorteio-das-ligas-betclic-masculina-e-feminina-este-sabado-no-cop/",
  verifiedAt:"2026-11-28",confidence:"Portuguese federation participant list",
  clubs:[
    ["CAB Madeira"],["CD Póvoa", "CD Póvoa ESC Online","Povoa"],["Esgueira", "Esgueira Aveiro OLI","Esgueira BC"],["FC Porto","Porto"],
    ["Portimonense SC","Portimonense"],["Ovarense","Ovarense GAVEX"],["Queluz","Queluz O Nosso Prego","CA Queluz"],["SC Braga","Braga"],
    ["SL Benfica","Benfica"],["Sporting CP","Sporting"],["UD Oliveirense","Oliveirense"],["Vitória SC","Vitoria Guimaraes","Vitória Guimarães"]
  ].map(([name,...aliases])=>({name,country:"Portugal",aliases}))
},{
  name:"Liga Betclic Feminina",country:"Portugal",season:"2026-27",side:"womens",
  source:"https://www.fpb.pt/noticia/o-arranque-de-2026-2027-sorteio-das-ligas-betclic-masculina-e-feminina-este-sabado-no-cop/",
  verifiedAt:"2026-11-28",confidence:"Portuguese federation participant list",
  clubs:[
    ["Basquete Barcelos","Basquete Barcelos HMMOTOR"],["CAB Madeira"],["CDE Francisco Franco","Francisco Franco"],["CRC Quinta dos Lombos","Quinta dos Lombos"],
    ["Esgueira","Esgueira Aveiro ECOVALOR"],["GDESSA Barreiro","GDESSA"],["GDRAR","GDRAR REMAX"],["Sanjoanense","Sanjoanense HELIOTEXTIL"],
    ["SC Coimbrões","SC Coimbrões SANCHO PANZA"],["SL Benfica","Benfica","Benfica Women"],["Sporting CP","Sporting","Sporting CP Women"],["Sportiva","Sportiva AZORISHOTELS","União Sportiva Women"]
  ].map(([name,...aliases])=>({name,country:"Portugal",aliases}))
},{
  name:"EuroLeague",country:"Europe",season:"2026-27",side:"mens",
  source:"https://mediacentre.euroleague.net/en/app/2/communication/communication/preview/24407",
  verifiedAt:"2026-11-28",confidence:"Official opening-round fixture list; Beşiktaş replaces Monaco",
  clubs:[
    {name:"Anadolu Efes Istanbul",country:"Türkiye",aliases:["Anadolu Efes"]},
    {name:"Armani Olimpia Milano",country:"Italy",aliases:["Armani Olimpia Milan","Olimpia Milano","EA7 Emporio Armani Milan"]},
    {name:"Beşiktaş Istanbul",country:"Türkiye",aliases:["Beşiktaş"]},
    {name:"Crvena Zvezda Meridianbet Belgrade",country:"Serbia",aliases:["Crvena Zvezda","Red Star Belgrade"]},
    {name:"Dubai Basketball",country:"United Arab Emirates"},
    {name:"FC Barcelona",country:"Spain",aliases:["Barça","FC Barcelona Bàsquet"]},
    {name:"FC Bayern Munich",country:"Germany",aliases:["Bayern Munich","FC Bayern München"]},
    {name:"Fenerbahçe Tarfin Istanbul",country:"Türkiye",aliases:["Fenerbahce Istanbul","Fenerbahçe Tarfin","Fenerbahçe Beko Istanbul"]},
    {name:"Hapoel IBI Tel Aviv",country:"Israel",aliases:["Hapoel Tel Aviv"]},
    {name:"Kosner Baskonia Vitoria-Gasteiz",country:"Spain",aliases:["Baskonia","Kosner Baskonia"]},
    {name:"LDLC ASVEL Villeurbanne",country:"France",aliases:["ASVEL Villeurbanne"]},
    {name:"Maccabi Rapyd Tel Aviv",country:"Israel",aliases:["Maccabi Tel Aviv"]},
    {name:"Olympiacos Piraeus",country:"Greece",aliases:["Olympiacos"]},
    {name:"Panathinaikos AKTOR Athens",country:"Greece",aliases:["Panathinaikos Athens","Panathinaikos"]},
    {name:"Paris Basketball",country:"France"},
    {name:"Partizan Mozzart Bet Belgrade",country:"Serbia",aliases:["Partizan Belgrade","Partizan"]},
    {name:"Real Madrid",country:"Spain"},
    {name:"Valencia Basket",country:"Spain"},
    {name:"Virtus Bologna",country:"Italy"},
    {name:"Zalgiris Kaunas",country:"Lithuania",aliases:["Žalgiris Kaunas"]}
  ]
},{
  name:"Liga Endesa",country:"Spain",season:"2026-27",side:"mens",leagueAliases:["Liga ACB"],
  source:"https://acb.com/es/liga/equipos?_rsc=j8t6m",
  verifiedAt:"2026-11-28",confidence:"Official ACB 2026-27 teams; Andorra club origin separate from Spanish competition",
  clubs:[
    ["Joventut Badalona","ASISA Joventut"],["FC Barcelona","Barça"],["Casademont Zaragoza"],["Bàsquet Girona","FIATC Girona"],
    ["Hiopos Lleida","ILERNA Lleida","Força Lleida"],["Bàsquet Manresa","BAXI Manresa","KIDS&US Manresa"],["Kosner Baskonia","Baskonia","Kosner Baskonia Vitoria-Gasteiz"],
    ["La Laguna Tenerife","Lenovo Tenerife"],["Leyma Coruña","Leyma Basquet Coruña"],["Monbus Obradoiro"],["Real Madrid"],["Recoletas Salud Burgos","San Pablo Burgos","Recoletas Salud San Pablo Burgos"],["Río Breogán"],
    ["Surne Bilbao Basket","Bilbao Basket"],["UCAM Murcia"],["Unicaja Malaga","Unicaja"],["Valencia Basket"]
  ].map(([name,...aliases])=>({name,country:"Spain",aliases})).concat([{name:"MoraBanc Andorra",country:"Andorra",aliases:["BC Andorra"]}])
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
  const currentByTeam=new Map<string,Set<string>>();
  let wrongSidePrimary=0,unavailablePrimary=0,wrongSideMemberships=0;
  function link(leagueId:string,teamId:string){
    const league=leagueById.get(leagueId),team=teamById.get(teamId);
    if(!league||!team||!league.basketball_type||league.basketball_type!==team.basketball_type)return;
    if(!currentByLeague.has(leagueId))currentByLeague.set(leagueId,new Set());
    currentByLeague.get(leagueId)!.add(teamId);
  }
  for(const team of teams)if(team.league_id){
    const league=leagueById.get(team.league_id);
    if(!league)unavailablePrimary++;
    else if(league.basketball_type!==team.basketball_type)wrongSidePrimary++;
    else link(team.league_id,team.id);
  }
  for(const row of memberships){
    const league=leagueById.get(row.league_id);
    const team=teamById.get(row.team_id);
    if(!league||!team)continue;
    if(league.basketball_type!==team.basketball_type){wrongSideMemberships++;continue;}
    if(!league.season||row.season===league.season)link(row.league_id,row.team_id);
    if(league.season&&row.season===league.season){
      if(!currentByTeam.has(team.id))currentByTeam.set(team.id,new Set());
      currentByTeam.get(team.id)!.add(league.id);
    }
  }
  const coverage=leagues.map(league=>{
    const ids=currentByLeague.get(league.id)||new Set<string>();
    const clubs=[...ids].flatMap(id=>{const team=teamById.get(id);return team?[team]:[]});
    const evidence=verifiedRosters.find(row=>(row.side||"mens")===league.basketball_type&&[row.name,...(row.leagueAliases||[])].some(name=>normalized(name)===normalized(league.name))&&row.country===league.country&&row.season===league.season);
    const expected=evidence?.clubs||[];
    const matches=(club:DirectoryTeam,e:ClubEvidence)=>normalized(club.country)===normalized(e.country)&&[e.name,...(e.aliases||[])].some(name=>normalized(name)===normalized(club.name));
    const missing=expected.filter(e=>!clubs.some(club=>matches(club,e))).map(e=>e.name);
    const ambiguous=expected.filter(e=>clubs.filter(club=>matches(club,e)).length>1).map(e=>e.name);
    const unexpected=evidence?clubs.filter(club=>!expected.some(e=>matches(club,e))).map(club=>club.name):[];
    return {id:league.id,name:league.name,country:league.country,side:league.basketball_type,season:league.season,actual:clubs.length,clubIds:[...ids].sort(),evidence,expected:evidence?expected.length:null,missing,unexpected,ambiguous};
  }).sort((a,b)=>Number(!!b.evidence)-Number(!!a.evidence)||(a.country||"").localeCompare(b.country||"")||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const linkedIdentityIds=new Map<string,string[]>();
  for(const team of teams)if(team.league_id){const key=identityKey(team);const ids=linkedIdentityIds.get(key)||[];ids.push(team.id);linkedIdentityIds.set(key,ids);}
  const unlinkedReview=teams.filter(team=>!team.league_id).map(team=>{
    const candidates=coverage.filter(row=>row.evidence&&(row.evidence.side||"mens")===team.basketball_type&&row.evidence.clubs.some(club=>normalized(team.country)===normalized(club.country)&&[club.name,...(club.aliases||[])].some(name=>normalized(name)===normalized(team.name))));
    const sameNameLinkedIds=linkedIdentityIds.get(identityKey(team))||[];
    const reviewedAliasLinkedIds=[...new Set(candidates.flatMap(row=>row.evidence!.clubs.filter(club=>normalized(team.country)===normalized(club.country)&&[club.name,...(club.aliases||[])].some(name=>normalized(name)===normalized(team.name))).flatMap(club=>[club.name,...(club.aliases||[])].flatMap(name=>linkedIdentityIds.get([normalized(club.country),team.basketball_type,normalized(name)].join(":"))||[]))))].filter(id=>!sameNameLinkedIds.includes(id));
    return {id:team.id,name:team.name,country:team.country,side:team.basketball_type,currentMembershipLeagueIds:[...(currentByTeam.get(team.id)||[])],reviewedRosterLeagueIds:candidates.map(row=>row.id),sameNameLinkedIds,reviewedAliasLinkedIds};
  });
  return {countries:countryLabels.size,leagues:leagues.length,teams:teams.length,
    wrongSidePrimary,unavailablePrimary,wrongSideMemberships,unlinkedWithCurrentMembership:unlinkedReview.filter(row=>row.currentMembershipLeagueIds.length>0).length,
    unlinkedWithReviewedRoster:unlinkedReview.filter(row=>row.reviewedRosterLeagueIds.length>0).length,unlinkedWithSameNameLinked:unlinkedReview.filter(row=>row.sameNameLinkedIds.length>0).length,unlinkedWithReviewedAlias:unlinkedReview.filter(row=>row.reviewedAliasLinkedIds.length>0).length,unlinkedReview,
    mensTeams:teams.filter(row=>row.basketball_type==="mens").length,womensTeams:teams.filter(row=>row.basketball_type==="womens").length,
    unlinked:teams.filter(row=>!row.league_id).length,
    missingLeagueLogos:leagues.filter(absentLogo).length,missingTeamLogos:teams.filter(absentLogo).length,
    invalidLogoURLs:[...teams,...leagues].filter(invalidLogo).length,
    duplicateTeamGroups:duplicateGroups(teams),duplicateLeagueGroups:duplicateGroups(leagues),
    missingSeason:leagues.filter(row=>!row.season?.trim()).length,
    countryAliasWarnings:[...countryLabels].filter(label=>["Czech Republic","Bosnia & Herzegovina","Chinese Taipei","Mexico City"].includes(label!)).sort(),
    coverage,verifiedLeagueCount:coverage.filter(row=>!!row.evidence&&!row.evidence.confidence.startsWith("Provisional:")).length,
    provisionalLeagueCount:coverage.filter(row=>row.evidence?.confidence.startsWith("Provisional:")).length,
    missingReviewedCompetitions:verifiedRosters.filter(evidence=>!coverage.some(row=>row.evidence===evidence)).map(evidence=>({name:evidence.name,country:evidence.country,side:evidence.side||"mens",season:evidence.season,expected:evidence.clubs.length,source:evidence.source,confidence:evidence.confidence,existingNameWithoutSeason:leagues.some(league=>league.country===evidence.country&&league.basketball_type===(evidence.side||"mens")&&[evidence.name,...(evidence.leagueAliases||[])].some(name=>normalized(name)===normalized(league.name)))}))};
}

/** IDs, not fuzzy names, establish the existing legacy team mirror relationship.
 * Never infer a league equivalence from a team ID; league IDs are distinct namespaces.
 */
export function deriveWomensCatalogParity(
  canonicalLeagues:DirectoryLeague[], canonicalTeams:DirectoryTeam[],
  legacyLeagues:{id:string;name:string;country:string|null}[],
  legacyTeams:{id:string;name:string;country:string|null;league_id:string|null}[]
){
  const women=canonicalTeams.filter(row=>row.basketball_type==="womens");
  const womensLeagues=canonicalLeagues.filter(row=>row.basketball_type==="womens");
  const canonical=unique(women),legacy=unique(legacyTeams);
  unique(legacyLeagues);
  const shared=legacyTeams.filter(row=>canonical.has(row.id));
  const missingLegacy=women.filter(row=>!legacy.has(row.id));
  const missingCanonical=legacyTeams.filter(row=>!canonical.has(row.id));
  const missingCanonicalPrimary=shared.filter(row=>row.league_id&&!canonical.get(row.id)?.league_id);
  const legacyLeagueCandidates=legacyLeagues.map(row=>{
    const matches=womensLeagues.filter(league=>normalized(league.country)===normalized(row.country)&&normalized(league.name)===normalized(row.name));
    return {id:row.id,name:row.name,country:row.country,candidateIds:matches.map(league=>league.id),legacyClubs:legacyTeams.filter(team=>team.league_id===row.id).length};
  });
  return {canonicalTeams:women.length,canonicalLeagues:womensLeagues.length,legacyTeams:legacyTeams.length,legacyLeagues:legacyLeagues.length,
    sharedIds:shared.length,missingLegacy:missingLegacy.length,missingCanonical:missingCanonical.length,linkedLegacyWithoutCanonicalPrimary:missingCanonicalPrimary.length,
    exactLeagueCandidates:legacyLeagueCandidates.filter(row=>row.candidateIds.length===1).length,legacyLeagueCandidates};
}

/** Compare roster identity sets, not only totals. Season transitions are
 * reported separately and never treated as same-season roster comparisons. */
export function compareDirectoryCoverage(
 before:ReturnType<typeof deriveDirectoryQuality>,after:ReturnType<typeof deriveDirectoryQuality>
){
 const oldById=new Map(before.coverage.map(row=>[row.id,row]));
 const newById=new Map(after.coverage.map(row=>[row.id,row]));
 const removedLeagues=before.coverage.filter(row=>!newById.has(row.id)).map(row=>({id:row.id,name:row.name,season:row.season}));
 const addedLeagues=after.coverage.filter(row=>!oldById.has(row.id)).map(row=>({id:row.id,name:row.name,season:row.season}));
 const seasonChanges=after.coverage.flatMap(row=>{const old=oldById.get(row.id);return old&&old.season!==row.season?[{id:row.id,name:row.name,before:old.season,after:row.season}]:[]});
 const rosterChanges=after.coverage.flatMap(row=>{
   const old=oldById.get(row.id);
   if(!old||old.season!==row.season)return [];
   const oldIds=new Set(old.clubIds),newIds=new Set(row.clubIds);
   const added=row.clubIds.filter(id=>!oldIds.has(id)),removed=old.clubIds.filter(id=>!newIds.has(id));
   return added.length||removed.length?[{id:row.id,name:row.name,season:row.season,before:old.actual,after:row.actual,added,removed}]:[];
 });
 return {removedLeagues,addedLeagues,seasonChanges,rosterChanges};
}
