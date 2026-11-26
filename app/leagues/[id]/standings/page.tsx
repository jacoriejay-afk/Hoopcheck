import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { validApiSportsSeason } from "../../../../lib/hoopdata-api-sports-competition";
import { loadLicensedStandings } from "../../../../lib/hoopdata-standings-preview-server";
import LicensedStandingsTable from "../../../../components/LicensedStandingsTable";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"League standings | HoopCheck™",robots:{index:false,follow:false}};
export const maxDuration=15;
export default async function LeagueStandings({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{season?:string|string[]}>}){
 if(process.env.VERCEL_ENV!=="preview"||process.env.HOOPDATA_STANDINGS_WEB_PREVIEW_ENABLED!=="true")notFound();
 const leagueId=(await params).id.toLowerCase(),season=(await searchParams).season;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(leagueId)||typeof season!=="string"||!validApiSportsSeason(season))notFound();
 const view=await loadLicensedStandings(leagueId,season,"web-display");
 return <main className="page-shell"><div className="page-container"><header className="hero-card"><p>HoopCheck™ · Licensed preview</p><h1>League standings</h1><Link href={`/leagues/${leagueId}`} prefetch={false}>Back to league</Link></header>{view?<LicensedStandingsTable key={view.expiresAt} view={view}/>:<section className="card"><h2>Standings unavailable</h2><p>Current standings cannot be verified or are not approved for display. No estimated ranks are shown.</p></section>}</div></main>;
}
