import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanTeamSearch, TEAM_PAGE_SIZE } from "./teamDirectory.ts";

export function leagueDirectoryQuery(client:SupabaseClient,search:string,start:number,country=""){
 let query=client.from("leagues").select("id,name,country,level,season,website,logo_url").eq("active",true).eq("basketball_type","mens");
 if(country)query=query.eq("country",country);
 query=query.order("name",{ascending:true}).order("id",{ascending:true}).range(start,start+TEAM_PAGE_SIZE);
 const clean=cleanTeamSearch(search);
 if(clean)query=query.or(`name.ilike.%${clean}%,country.ilike.%${clean}%,level.ilike.%${clean}%`);
 return query;
}
export async function readLeagueCountries(client:SupabaseClient,signal:AbortSignal){
 const labels=new Set<string>();let complete=false;
 for(let start=0;start<5000;start+=500){
  if(signal.aborted)throw Error("League country request cancelled");
  const result=await client.from("leagues").select("id,country").eq("active",true).eq("basketball_type","mens").order("id",{ascending:true}).range(start,start+499).abortSignal(signal);
  if(result.error||!Array.isArray(result.data)||result.data.length>500||signal.aborted)throw Error("League countries unavailable");
  for(const row of result.data)if(typeof row.country==="string"&&row.country.trim()&&row.country.length<=200)labels.add(row.country);
  if(result.data.length<500){complete=true;break;}
 }
 return {countries:[...labels].sort((a,b)=>a.localeCompare(b)),complete};
}
