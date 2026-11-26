import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parsePrivateCareerClaim,privateClaimFields,missingClubFields } from "../../../../lib/career/private-claim-input";
export const dynamic="force-dynamic";
function reply(body:object,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});}
async function authenticate(request:Request){
 if(process.env.HOOPCHECK_CAREER_CLAIMS_ENABLED!=="true")return {ok:false as const,response:reply({error:"Career claims are not available yet."},503)};
 const token=request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
 if(!token)return {ok:false as const,response:reply({error:"Sign in to manage career history."},401)};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return {ok:false as const,response:reply({error:"Career claims are unavailable."},503)};
 const db=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{autoRefreshToken:false,persistSession:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return {ok:false as const,response:reply({error:"Invalid session."},401)};
 const profile=await db.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
 if(profile.error)return {ok:false as const,response:reply({error:"Career claims are unavailable."},503)};
 if(profile.data?.account_type!=="player")return {ok:false as const,response:reply({error:"Career claims are for player accounts."},403)};
 return {ok:true as const,db,userId:user.id};
}
export async function GET(request:Request){
 try{
   const auth=await authenticate(request);
   if(!auth.ok)return auth.response;
   const [claims,requests]=await Promise.all([
     auth.db.from("player_team_season_claims").select(privateClaimFields).eq("player_id",auth.userId).order("created_at",{ascending:false}).order("id").limit(101),
     auth.db.from("historical_club_requests").select(missingClubFields).eq("player_id",auth.userId).order("created_at",{ascending:false}).order("id").limit(101)
   ]);
   if(claims.error||requests.error)return reply({error:"Career history could not load."},503);
   const rows=claims.data||[],missing=requests.data||[];
   const visible=rows.slice(0,100);
   // Historical names must match the canonical club and exact season; never
   // substitute a current club name or infer a successor by name similarity.
   const keys=["team_id","womens_team_id"] as const;
   const snapshots=await Promise.all(keys.map(async key=>{
     const ids=[...new Set(visible.map(row=>row[key]).filter((id):id is string=>typeof id==="string"))];
     if(!ids.length)return [];
     const years=[...new Set(visible.filter(row=>typeof row[key]==="string").map(row=>row.season_start_year))];
     const result=await auth.db.from("historical_club_seasons").select("team_id,womens_team_id,season_start_year,season_end_year,historical_name,historical_league,historical_division,historical_country").in(key,ids).in("season_start_year",years).limit(1000);
     return result.error?[]:result.data||[];
   }));
   const labels=snapshots.flat();
   return reply({claims:visible.map(row=>{
     const label=labels.find(s=>s.team_id===row.team_id&&s.womens_team_id===row.womens_team_id&&s.season_start_year===row.season_start_year&&s.season_end_year===row.season_end_year);
     return {...row,historicalClub:label?{name:label.historical_name,league:label.historical_league,division:label.historical_division,country:label.historical_country}:null};
   }),missingClubs:missing.slice(0,100),hasMore:rows.length>100||missing.length>100});
 }catch{return reply({error:"Career history could not load."},503);}
}
export async function POST(request:Request){
 try{
   const auth=await authenticate(request);
   if(!auth.ok)return auth.response;
   const contentLength=request.headers.get("content-length");
   if(contentLength&&Number(contentLength)>4096)return reply({error:"Career claim is too large."},413);
   if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return reply({error:"JSON required."},415);
   let raw:unknown;
   try{const body=await request.text();if(body.length>4096)return reply({error:"Career claim is too large."},413);raw=JSON.parse(body);}catch{return reply({error:"Invalid request."},400);}
   const input=parsePrivateCareerClaim(raw,new Date().getUTCFullYear());
   if(!input)return reply({error:"Provide valid career history and an exact season."},400);
   const table=input.kind==="claim"?"player_team_season_claims":"historical_club_requests";
   // Only allowlisted columns; player_id comes from authenticated session, never request.
   // Database supplies pending status. Never update an existing verified affiliation.
   const result=await auth.db.from(table).insert({...input.row,player_id:auth.userId}).select("id").single();
   if(result.error?.code==="23505")return reply({error:"This career claim already exists."},409);
   if(result.error?.code==="23503")return reply({error:"Team is unavailable. Submit a missing club request instead."},422);
   if(result.error?.code==="42501")return reply({error:"Career claim is not permitted."},403);
   if(result.error||!result.data)return reply({error:"Career claim could not be saved."},503);
   return reply({id:result.data.id,kind:input.kind,status:"pending"},201);
 }catch{return reply({error:"Career claim could not be saved."},503);}
}
