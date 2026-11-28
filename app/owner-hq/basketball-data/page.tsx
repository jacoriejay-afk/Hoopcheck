import type { Metadata } from "next";
import Link from "next/link";
import { ambassadorDb, requireAmbassadorSession } from "../../../lib/ambassador/server";
import { deriveDirectoryQuality, deriveWomensCatalogParity, type DirectoryLeague, type DirectoryTeam, type DirectoryMembership } from "../../../lib/owner/directory-quality";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {title:"Basketball Data Center | HoopCheck™",robots:{index:false,follow:false}};

export default async function BasketballDataCenter(){
  await requireAmbassadorSession("/owner-hq/basketball-data",true);
  const db=process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL ? ambassadorDb() : null;
  const now=new Date(), since=new Date(now.getTime()-25*60_000).toISOString(), upcoming=new Date(now.getTime()+7*86400_000).toISOString();
  const opt={head:true,count:"exact"} as const;
  async function count(query:PromiseLike<{count:number|null;error:unknown}>|undefined){
    try{const r=await query;return r&&!r.error&&r.count!==null?String(r.count):"Unavailable";}catch{return "Unavailable";}
  }
  async function latest(){
    try{const r=await db?.from("fan_live_games").select("score_updated_at").not("score_updated_at","is",null).order("score_updated_at",{ascending:false}).limit(1).maybeSingle();
      const stamp=r?.data?.score_updated_at;return !r?.error&&typeof stamp==="string"&&Number.isFinite(Date.parse(stamp))?new Date(stamp).toISOString():"Unavailable";
    }catch{return "Unavailable";}
  }
  const values=await Promise.all([
    count(db?.from("fan_live_games").select("id",opt).eq("provider_source","api-sports-basketball")),
    count(db?.from("fan_live_games").select("id",opt).eq("status","live")),
    count(db?.from("fan_live_games").select("id",opt).eq("status","live").lt("score_updated_at",since)),
    count(db?.from("fan_live_games").select("id",opt).eq("status","live").is("score_updated_at",null)),
    count(db?.from("fan_live_games").select("id",opt).eq("status","scheduled").gte("scheduled_at",now.toISOString()).lte("scheduled_at",upcoming)),
    count(db?.from("fan_live_games").select("id",opt).eq("status","scheduled").gte("scheduled_at",now.toISOString()).lte("scheduled_at",upcoming).is("opponent_team_id",null)),
    count(db?.from("fan_live_team_provider_map").select("team_id",opt).eq("active",true)),
    latest(),
  ]);
  // Count catalog sides separately; the legacy women's table may contain mirrors.
  const directoryCounts=await Promise.all([
    count(db?.from("leagues").select("id",opt).eq("active",true).eq("basketball_type","mens")),
    count(db?.from("leagues").select("id",opt).eq("active",true).eq("basketball_type","womens")),
    count(db?.from("womens_leagues").select("id",opt).eq("active",true)),
    count(db?.from("fan_live_games").select("id",opt).is("league_id",null)),
  ]);
  async function readAll<T>(query:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>){
    const rows:T[]=[];
    for(let page=0;page<100;page++){
      const result=await query(page*100,page*100+99);
      if(result.error||!result.data)throw Error("Directory quality read failed");
      rows.push(...result.data);
      if(result.data.length<100)return rows;
    }
    throw Error("Directory quality paging ceiling reached");
  }
  async function qualitySnapshot(){
    const client=db;
    if(!client)return null;
    try{
      const [leagues,teams,memberships]=await Promise.all([
        readAll<DirectoryLeague>((from,to)=>client.from("leagues").select("id,name,country,basketball_type,logo_url,season").eq("active",true).order("id").range(from,to)),
        readAll<DirectoryTeam>((from,to)=>client.from("teams").select("id,name,country,basketball_type,logo_url,league_id").eq("active",true).order("id").range(from,to)),
        readAll<DirectoryMembership>((from,to)=>client.from("team_league_memberships").select("team_id,league_id,season").eq("active",true).order("id").range(from,to)),
      ]);
      const quality=deriveDirectoryQuality(leagues,teams,memberships);
      // Legacy tables can be unavailable on a divergent test schema. Do not hide the
      // canonical quality results or represent an unavailable mirror count as zero.
      try{
        const [legacyLeagues,legacyTeams]=await Promise.all([
          readAll<{id:string;name:string;country:string|null}>((from,to)=>client.from("womens_leagues").select("id,name,country").eq("active",true).order("id").range(from,to)),
          readAll<{id:string;name:string;country:string|null;league_id:string|null}>((from,to)=>client.from("womens_teams").select("id,name,country,league_id").eq("active",true).order("id").range(from,to)),
        ]);
        return {...quality,womensParity:deriveWomensCatalogParity(leagues,teams,legacyLeagues,legacyTeams)};
      }catch{return {...quality,womensParity:null};}
    }catch{return null;}
  }
  async function latestDirectorySync(){
    try{
      const result=await db?.from("directory_sync_runs").select("finished_at").eq("status","completed").not("finished_at","is",null).order("finished_at",{ascending:false}).limit(1).maybeSingle();
      const stamp=result?.data?.finished_at;
      return !result?.error&&typeof stamp==="string"&&Number.isFinite(Date.parse(stamp))?new Date(stamp).toISOString():"Unavailable";
    }catch{return "Unavailable";}
  }
  const [quality,pendingRequests,failedSyncs,importErrors,lastSync,licensedSources]=await Promise.all([
    qualitySnapshot(),
    count(db?.from("directory_team_requests").select("id",opt).eq("status","pending")),
    count(db?.from("directory_sync_runs").select("id",opt).eq("status","failed")),
    count(db?.from("directory_import_jobs").select("id",opt).gt("error_rows",0)),
    latestDirectorySync(),
    count(db?.from("directory_sources").select("id",opt).eq("active",true).eq("commercial_use_allowed",true)),
  ]);
  const labels=["API-Sports stored fixture records","Provider-marked live records","Live records with delayed snapshots","Live records without a snapshot timestamp","Scheduled fixtures in next 7 days","Upcoming fixtures missing opponent mapping","Active existing provider team mappings","Latest observed fixture snapshot (UTC)"];
  return <main className="page-shell"><div className="page-container" style={{display:"grid",gap:16,paddingBlock:24}}>
    <header className="hero-card"><p>HoopCheck™ · Private owner workspace</p><h1>Basketball Data Center</h1><p>Read-only database observations. A stored fixture or a recent snapshot is not proof of complete league coverage or live provider health.</p><Link href="/owner-hq" prefetch={false}>Back to Owner HQ</Link></header>
    <section aria-label="Basketball data observations" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
      {labels.map((label,i)=><div className="dashboard-card" key={label}><p>{label}</p><strong>{values[i]}</strong></div>)}
    </section>
    <section className="dashboard-card"><h2>Men’s and women’s directory audit</h2><p>Active men’s league directory records: <strong>{directoryCounts[0]}</strong></p><p>Active women’s league directory records: <strong>{directoryCounts[1]}</strong></p><p>Legacy women’s league records: <strong>{directoryCounts[2]}</strong> (reported separately; may overlap)</p><p>Stored fixtures without an internal league mapping: <strong>{directoryCounts[3]}</strong></p><p>Directory counts are not verified provider coverage. Official schedules and standings require reviewed provider competition mappings.</p>{process.env.VERCEL_ENV==="preview"&&process.env.HOOPDATA_OWNER_COVERAGE_PREVIEW_ENABLED==="true"?<Link href="/owner-hq/basketball-data/coverage" prefetch={false}>Inspect per-league coverage and request budgets</Link>:null}</section>
    <section className="dashboard-card" aria-labelledby="directory-quality-heading"><h2 id="directory-quality-heading">Worldwide Directory Quality</h2>
      <p>Canonical active directory rows. Counts exclude legacy mirror tables. Source-verified expected counts are shown only for the exact reviewed competition season.</p>
      {!quality?<p role="status">Directory quality unavailable. No incomplete totals are shown.</p>:<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
          {([["Stored country labels",quality.countries],["Active leagues",quality.leagues],["Active teams",quality.teams],["Men’s teams",quality.mensTeams],["Women’s teams",quality.womensTeams],["Without primary league ID",quality.unlinked],["Teams missing stored logos",quality.missingTeamLogos],["Leagues missing stored logos",quality.missingLeagueLogos],["Malformed or unsafe logo URLs",quality.invalidLogoURLs],["Possible same-name team groups",quality.duplicateTeamGroups],["Possible same-name league groups",quality.duplicateLeagueGroups],["Leagues missing season labels",quality.missingSeason],["Source-reviewed league seasons",quality.verifiedLeagueCount]] as const).map(([label,value])=><div key={label} className="dashboard-card"><p>{label}</p><strong>{value}</strong></div>)}
        </div>
        <section aria-label="Women's directory parity"><h3>Women’s catalog parity</h3>
          {quality.womensParity?<><p>Canonical active teams: <strong>{quality.womensParity.canonicalTeams}</strong> · legacy active teams: <strong>{quality.womensParity.legacyTeams}</strong> · shared IDs: <strong>{quality.womensParity.sharedIds}</strong>.</p>
            <p>Canonical teams without active legacy entry: <strong>{quality.womensParity.missingLegacy}</strong> · legacy teams without active canonical entry: <strong>{quality.womensParity.missingCanonical}</strong> · linked legacy teams with no canonical primary league ID: <strong>{quality.womensParity.linkedLegacyWithoutCanonicalPrimary}</strong>.</p>
            <p>Exact-name/country canonical league candidates: <strong>{quality.womensParity.exactLeagueCandidates}</strong> / {quality.womensParity.legacyLeagues} legacy league records. These are candidates only, not verified season mappings.</p>
            <details><summary>Legacy women’s league mapping review</summary><ul>{quality.womensParity.legacyLeagueCandidates.map(row=><li key={row.id}>{row.country||"Country not listed"} · {row.name} · {row.legacyClubs} linked legacy records · {row.candidateIds.length===1?"One exact-name candidate":row.candidateIds.length===0?"No exact-name candidate":"Ambiguous candidates"}</li>)}</ul></details>
          </>:<p role="status">Women’s catalog parity unavailable.</p>}
          <p>Do not add catalog totals together or treat an unmatched ID as proof of a different club.</p>
        </section>
        {quality.countryAliasWarnings.length>0?<p>Country labels requiring review: {quality.countryAliasWarnings.join(", ")}. No country records are modified.</p>:null}
        <p>Logo checks inspect stored values only, not remote availability, licensing, or bundled fallbacks. Name groups are candidates, not merge decisions.</p>
        {quality.coverage.filter(row=>row.evidence).map(row=><div key={row.id} className="dashboard-card"><h3>{row.name} · {row.season}</h3><p><strong>{row.actual}</strong> current linked club IDs / <strong>{row.expected}</strong> announced clubs.</p><p>Missing identities: {row.missing.join(", ")||"None in reviewed list"}</p><p>Unexpected linked identities: {row.unexpected.join(", ")||"None in reviewed list"}</p><p>Ambiguous matches: {row.ambiguous.join(", ")||"None in reviewed list"}</p><p>{row.evidence?.confidence} · reviewed {row.evidence?.verifiedAt} · <a href={row.evidence?.source} target="_blank" rel="noreferrer">Roster source</a></p></div>)}
        {quality.missingReviewedCompetitions.length>0?<section aria-label="Missing reviewed competition seasons"><h3>Reviewed seasons not represented</h3>{quality.missingReviewedCompetitions.map(row=><div className="dashboard-card" key={row.country+":"+row.name+":"+row.side+":"+row.season}><strong>{row.country} · {row.name} · {row.side}</strong><p>{row.season}: {row.expected} source-listed clubs. {row.existingNameWithoutSeason?"A matching league name exists, but its exact season is not recorded.":"No matching active league season found."}</p><p>{row.confidence} · <a href={row.source} target="_blank" rel="noreferrer">Roster source</a></p></div>)}</section>:null}
        <details><summary>All league records and coverage ({quality.coverage.length})</summary><div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}><thead><tr><th scope="col">Country / competition</th><th scope="col">Season</th><th scope="col">Linked clubs</th><th scope="col">Expected</th></tr></thead><tbody>{quality.coverage.map(row=><tr key={row.id}><td>{row.country||"Country not listed"} · {row.name} · {row.side||"Side not listed"}</td><td>{row.season||"Not listed"}</td><td>{row.actual}</td><td>{row.expected??"Not verified"}</td></tr>)}</tbody></table></div></details>
      </>}
      <p>Pending team requests: <strong>{pendingRequests}</strong> · failed sync runs: <strong>{failedSyncs}</strong> · import jobs with errors: <strong>{importErrors}</strong></p>
      <p>Last recorded completed directory sync: <strong>{lastSync}</strong> · active commercial-use-approved directory sources: <strong>{licensedSources}</strong></p>
      <p>Unverified counts do not authorize an import, team transfer, or duplicate merge.</p><Link href="/admin/directory" prefetch={false}>Review directory records and correction workflows</Link>
    </section>
    <section className="dashboard-card"><h2>Provider operations</h2><p>API-Sports scheduled cadence: 15 minutes, best effort. The configured schedule is not a measured upstream refresh interval.</p><p>BALLDONTLIE live writes, shared quota counters and complete-season coverage certification are not activated by this dashboard. Unavailable metrics are not zero.</p><Link href="/admin/directory/providers" prefetch={false}>Directory provider records</Link></section>
  </div></main>;
}
