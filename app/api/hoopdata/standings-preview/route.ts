import { NextRequest, NextResponse } from "next/server";
import { loadLicensedStandings } from "../../../../lib/hoopdata-standings-preview-server";
import { resolveWomensStandingsAlias } from "../../../../lib/hoopdata-womens-directory-alias";
import { validApiSportsSeason } from "../../../../lib/hoopdata-api-sports-competition";
export const dynamic="force-dynamic";
export const maxDuration=15;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"}});
export async function GET(request:NextRequest){
 if(process.env.VERCEL_ENV!=="preview"||process.env.HOOPDATA_STANDINGS_APP_PREVIEW_ENABLED!=="true")return reply({error:"Disabled"},404);
 const params=new URL(request.url).searchParams;
 const leagueId=(params.get("leagueId")??"").toLowerCase(),season=params.get("season")??"",side=params.get("side");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(leagueId)||!validApiSportsSeason(season)||(side!=="mens"&&side!=="womens"))return reply({error:"Invalid league"},400);
 let canonical=leagueId,aliasExpiry=Infinity;
 if(side==="womens"){
  try{
   const raw=process.env.HOOPDATA_STANDINGS_WOMENS_LEAGUE_ALIASES??"";
   if(!raw||raw.length>100000)return reply({state:"unavailable"});
   const aliases=JSON.parse(raw);
   if(!Array.isArray(aliases)||aliases.length>1000)return reply({state:"unavailable"});
   const resolved=resolveWomensStandingsAlias(leagueId,aliases,new Date());
   if(!resolved)return reply({state:"unavailable"});canonical=resolved.canonicalLeagueId;aliasExpiry=Date.parse(resolved.expiresAt);
  }catch{return reply({state:"unavailable"});}
 }
 const view=await loadLicensedStandings(canonical,season,"app-display",side,side==="womens"?leagueId:undefined);
 if(!view)return reply({state:"unavailable"});
 const expiry=Math.min(Date.parse(view.expiresAt),aliasExpiry);
 if(!Number.isFinite(expiry)||expiry<=Date.now())return reply({state:"unavailable"});
 return reply({state:"available",view:{...view,expiresAt:new Date(expiry).toISOString(),leagueId,side}});
}
