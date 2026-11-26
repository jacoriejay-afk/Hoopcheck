import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { historicalClubSearch, historicalClubFields, historicalClubResultLimit } from "../../../../lib/career/historical-club-search";

export const dynamic = "force-dynamic";
function response(body: object, status = 200) {
 return NextResponse.json(body, {status, headers: {"Cache-Control": "no-store"}});
}
/** Historical directory search, not live team discovery or affiliation verification. */
export async function GET(request: Request) {
 if (process.env.HOOPCHECK_CAREER_CLAIMS_ENABLED !== "true") return response({error:"Historical career search is not available yet."},503);
 const input = historicalClubSearch(new URL(request.url).searchParams, new Date().getUTCFullYear());
 if (!input) return response({error:"Enter a team name, exact season and basketball category."},400);
 const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
 if (!token) return response({error:"Sign in to search career history."},401);
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if (!url || !key) return response({error:"Career search is unavailable."},503);
 try {
   const db = createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{autoRefreshToken:false,persistSession:false}});
   const {data:{user},error:authError} = await db.auth.getUser(token);
   if (authError || !user) return response({error:"Invalid session."},401);
   const {data:profile,error:profileError}=await db.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
   if (profileError) return response({error:"Career search is unavailable."},503);
   if (profile?.account_type !== "player") return response({error:"Career search is for player accounts."},403);
   const {data,error}=await db.from("historical_club_seasons").select(historicalClubFields)
     .eq("season_start_year",input.season.startYear).eq("season_end_year",input.season.endYear)
     .not(input.basketballType === "mens" ? "team_id" : "womens_team_id","is",null)
     .ilike("historical_name","%"+input.name+"%")
     .order("historical_name").order("id").limit(historicalClubResultLimit+1);
   if (error) return response({error:"Historical directory is unavailable. Try again later."},503);
   const rows=data||[];
   return response({results:rows.slice(0,historicalClubResultLimit),hasMore:rows.length>historicalClubResultLimit});
 } catch {
   return response({error:"Historical directory is unavailable. Try again later."},503);
 }
}
