import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCareerSeason } from "./claim-input";
export function exactSeasonReviewsEnabled(){return process.env.HOOPCHECK_EXACT_SEASON_REVIEWS_ENABLED==="true";}
export async function verifiedReviewSeason(db:SupabaseClient,playerId:string,teamId:string,source:"teams"|"womens_teams",input:unknown,nowYear:number){
 const season=parseCareerSeason(input,nowYear);
 if(!season)return {status:400 as const,error:"Select the exact season you played for this team."};
 const result=await db.from("player_team_season_claims").select("id")
  .eq("player_id",playerId).eq(source==="teams"?"team_id":"womens_team_id",teamId)
  .eq("season_start_year",season.startYear).eq("season_end_year",season.endYear)
  .eq("verification_status","verified").maybeSingle();
 if(result.error)return {status:503 as const,error:"Unable to verify your career history right now."};
 if(!result.data)return {status:403 as const,error:"Verify your affiliation for this team and season before reviewing."};
 return {status:200 as const,season:season.label};
}
