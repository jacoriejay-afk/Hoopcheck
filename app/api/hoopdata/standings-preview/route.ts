import { NextRequest, NextResponse } from "next/server";
import { loadLicensedStandings } from "../../../../lib/hoopdata-standings-preview-server";
import { validApiSportsSeason } from "../../../../lib/hoopdata-api-sports-competition";
export const dynamic="force-dynamic";
export const maxDuration=15;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"}});
export async function GET(request:NextRequest){
 if(process.env.VERCEL_ENV!=="preview"||process.env.HOOPDATA_STANDINGS_APP_PREVIEW_ENABLED!=="true")return reply({error:"Disabled"},404);
 const params=new URL(request.url).searchParams;
 const leagueId=(params.get("leagueId")??"").toLowerCase(),season=params.get("season")??"",side=params.get("side");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(leagueId)||!validApiSportsSeason(season)||(side!=="mens"&&side!=="womens"))return reply({error:"Invalid league"},400);
 const view=await loadLicensedStandings(leagueId,season,"app-display",side);
 return view?reply({state:"available",view:{...view,side}}):reply({state:"unavailable"});
}
