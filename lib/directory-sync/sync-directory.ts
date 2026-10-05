import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedDirectory, SyncEntityType } from "./types";
import { clean, normalizedKey } from "./sync-record";

type Result={seen:number;created:number;updated:number;skipped:number};

export async function syncNormalizedDirectory(
 supabase:SupabaseClient,
 sourceId:string,
 entityType:SyncEntityType,
 directory:NormalizedDirectory
):Promise<Result>{
 const result:Result={seen:0,created:0,updated:0,skipped:0};
 const leagueIds=new Map<string,string>(), teamIds=new Map<string,string>();

 for(const r of directory.leagues){
  if(entityType!=="leagues" && !r.name) continue;
  const name=clean(r.name); if(!name){result.skipped++;continue;}
  result.seen++;
  let existing:any=null;
  if(clean(r.externalId)){const q=await supabase.from("leagues").select("id").eq("source_id",sourceId).eq("external_id",clean(r.externalId)).limit(1).maybeSingle();if(q.error)throw q.error;existing=q.data;}
  if(!existing){const q=await supabase.from("leagues").select("id").ilike("name",name).eq("country",clean(r.country)).limit(1).maybeSingle();if(q.error&&q.error.code!=="PGRST116")throw q.error;existing=q.data;}
  const payload={name,country:clean(r.country),level:clean(r.level),season:clean(r.season),external_id:clean(r.externalId),source_id:sourceId,last_synced_at:new Date().toISOString(),active:true};
  if(existing){const q=await supabase.from("leagues").update(payload).eq("id",existing.id).select("id").single();if(q.error)throw q.error;leagueIds.set(normalizedKey(name,r.country),existing.id);result.updated++;await supabase.from("directory_change_log").insert({entity_type:"league",entity_id:existing.id,source_id:sourceId,action:"updated"});}
  else{const q=await supabase.from("leagues").insert(payload).select("id").single();if(q.error)throw q.error;leagueIds.set(normalizedKey(name,r.country),q.data.id);result.created++;await supabase.from("directory_change_log").insert({entity_type:"league",entity_id:q.data.id,source_id:sourceId,action:"created"});}
 }
 for(const r of directory.teams){
  const name=clean(r.name);if(!name){result.skipped++;continue;}result.seen++;
  let leagueId=r.leagueExternalId?null:leagueIds.get(normalizedKey(r.leagueName||"",r.country));
  if(r.leagueExternalId){const q=await supabase.from("leagues").select("id").eq("source_id",sourceId).eq("external_id",clean(r.leagueExternalId)).limit(1).maybeSingle();if(q.error)throw q.error;leagueId=q.data?.id??null;}
  let existing:any=null;
  if(clean(r.externalId)){const q=await supabase.from("teams").select("id").eq("source_id",sourceId).eq("external_id",clean(r.externalId)).limit(1).maybeSingle();if(q.error)throw q.error;existing=q.data;}
  if(!existing){const q=await supabase.from("teams").select("id").ilike("name",name).eq("country",clean(r.country)).limit(1).maybeSingle();if(q.error&&q.error.code!=="PGRST116")throw q.error;existing=q.data;}
  const payload:any={name,country:clean(r.country),city:clean(r.city),league_id:leagueId,league_name:clean(r.leagueName),external_id:clean(r.externalId),source_id:sourceId,last_synced_at:new Date().toISOString(),active:true};
  if(existing){const q=await supabase.from("teams").update(payload).eq("id",existing.id).select("id").single();if(q.error)throw q.error;teamIds.set(normalizedKey(name,r.country),existing.id);result.updated++;await supabase.from("directory_change_log").insert({entity_type:"team",entity_id:existing.id,source_id:sourceId,action:"updated"});}
  else{const q=await supabase.from("teams").insert(payload).select("id").single();if(q.error)throw q.error;teamIds.set(normalizedKey(name,r.country),q.data.id);result.created++;await supabase.from("directory_change_log").insert({entity_type:"team",entity_id:q.data.id,source_id:sourceId,action:"created"});}
  if(leagueId){await supabase.from("team_league_memberships").upsert({team_id:existing?.id??teamIds.get(normalizedKey(name,r.country)),league_id:leagueId,season:clean(r.season),start_date:clean(r.startDate),end_date:clean(r.endDate),active:true},{onConflict:"team_id,league_id,season"});}
 }
 for(const r of directory.coaches){
  const name=clean(r.name);if(!name){result.skipped++;continue;}result.seen++;
  let teamId=r.teamExternalId?null:teamIds.get(normalizedKey(r.teamName||"",r.country));
  if(r.teamExternalId){const q=await supabase.from("teams").select("id").eq("source_id",sourceId).eq("external_id",clean(r.teamExternalId)).limit(1).maybeSingle();if(q.error)throw q.error;teamId=q.data?.id??null;}
  let existing:any=null;
  if(clean(r.externalId)){const q=await supabase.from("coaches").select("id").eq("source_id",sourceId).eq("external_id",clean(r.externalId)).limit(1).maybeSingle();if(q.error)throw q.error;existing=q.data;}
  if(!existing){const q=await supabase.from("coaches").select("id").ilike("name",name).eq("country",clean(r.country)).limit(1).maybeSingle();if(q.error&&q.error.code!=="PGRST116")throw q.error;existing=q.data;}
  const payload:any={name,country:clean(r.country),city:clean(r.city),current_team_id:teamId,external_id:clean(r.externalId),source_id:sourceId,last_synced_at:new Date().toISOString(),active:true};
  if(existing){const q=await supabase.from("coaches").update(payload).eq("id",existing.id).select("id").single();if(q.error)throw q.error;result.updated++;await supabase.from("directory_change_log").insert({entity_type:"coach",entity_id:existing.id,source_id:sourceId,action:"updated"});}
  else{const q=await supabase.from("coaches").insert(payload).select("id").single();if(q.error)throw q.error;existing=q.data;result.created++;await supabase.from("directory_change_log").insert({entity_type:"coach",entity_id:existing.id,source_id:sourceId,action:"created"});}
  if(teamId){await supabase.from("coach_team_assignments").upsert({coach_id:existing.id,team_id:teamId,role:clean(r.role),season:clean(r.season),start_date:clean(r.startDate),end_date:clean(r.endDate),active:true},{onConflict:"coach_id,team_id,season"});}
 }
 return result;
}
