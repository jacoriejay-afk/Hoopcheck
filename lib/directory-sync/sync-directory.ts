import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedDirectory, SyncEntityType } from "./types";
import { clean, normalizedKey } from "./sync-record";

type Result={seen:number;created:number;updated:number;skipped:number};

// PostgREST ilike accepts SQL wildcards and "*" as an alias for "%". Do not
// silently interpret a provider's literal name as a search pattern.
function literalName(name:string):string{
 if(/[%_*\\]/.test(name))throw new Error("Directory identity requires manual review: name contains pattern characters");
 return name;
}


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
  if(clean(r.externalId)){const q=await supabase.from("leagues").select("id").eq("source_id",sourceId).eq("external_id",clean(r.externalId)).eq("basketball_type","mens").limit(2).maybeSingle();if(q.error)throw q.error;existing=q.data;}
  if(!existing){const q=await supabase.from("leagues").select("id").ilike("name",literalName(name)).eq("country",clean(r.country)).eq("basketball_type","mens").limit(2).maybeSingle();if(q.error)throw q.error;existing=q.data;}
  const payload={name,country:clean(r.country),level:clean(r.level),...(existing&&!clean(r.season)?{}:{season:clean(r.season)}),external_id:clean(r.externalId),source_id:sourceId,last_synced_at:new Date().toISOString(),active:true};
  if(existing){const q=await supabase.from("leagues").update(payload).eq("id",existing.id).select("id").single();if(q.error)throw q.error;leagueIds.set(normalizedKey(name,r.country),existing.id);result.updated++;await supabase.from("directory_change_log").insert({entity_type:"league",entity_id:existing.id,source_id:sourceId,action:"updated"});}
  else{const q=await supabase.from("leagues").insert(payload).select("id").single();if(q.error)throw q.error;leagueIds.set(normalizedKey(name,r.country),q.data.id);result.created++;await supabase.from("directory_change_log").insert({entity_type:"league",entity_id:q.data.id,source_id:sourceId,action:"created"});}
 }
 for(const r of directory.teams){
  const name=clean(r.name);if(!name){result.skipped++;continue;}result.seen++;
  const leagueExternalId=clean(r.leagueExternalId),leagueName=clean(r.leagueName);
  let leagueId=leagueExternalId?null:leagueIds.get(normalizedKey(leagueName||"",r.country))??null;
  if(leagueExternalId){
    const q=await supabase.from("leagues").select("id").eq("source_id",sourceId).eq("external_id",leagueExternalId).eq("basketball_type","mens").eq("active",true).limit(2).maybeSingle();
    if(q.error)throw q.error;leagueId=q.data?.id??null;
  }else if(!leagueId&&leagueName&&clean(r.country)){
    const q=await supabase.from("leagues").select("id").ilike("name",literalName(leagueName)).eq("country",clean(r.country)).eq("basketball_type","mens").eq("active",true).limit(2).maybeSingle();
    if(q.error)throw q.error;leagueId=q.data?.id??null;
  }
  // An unresolved competition is review work, not evidence of a transfer.
  // Missing provider labels must never erase a previously established primary link.
  let existing:any=null;
  if(clean(r.externalId)){const q=await supabase.from("teams").select("id,league_id,league_name").eq("source_id",sourceId).eq("external_id",clean(r.externalId)).eq("basketball_type","mens").limit(2).maybeSingle();if(q.error)throw q.error;existing=q.data;}
  if(!existing){
    let q= supabase.from("teams").select("id,name,city,basketball_type,league_id,league_name").ilike("name",literalName(name)).eq("country",clean(r.country)).eq("basketball_type","mens").limit(2);
    q=clean(r.city)?q.eq("city",clean(r.city)):q.is("city",null);
    const match=await q.maybeSingle();
    if(match.error)throw match.error;
    existing=match.data;
  }
  // An existing primary can coexist with an international membership. Never
  // replace it from this generic provider import; explicit owner review is needed.
  if(!existing && (leagueExternalId||leagueName) && !leagueId)throw Error("Directory affiliation requires manual review: unresolved competition");
  const affiliation=existing?.league_id
    ? {}
    : leagueId
      ? {league_id:leagueId,league_name:leagueName??existing?.league_name??null}
      : existing ? {} : {league_id:null,league_name:null};
  const payload:any={name,country:clean(r.country),city:clean(r.city),...affiliation,external_id:clean(r.externalId),source_id:sourceId,last_synced_at:new Date().toISOString(),active:true};
  if(existing){const q=await supabase.from("teams").update(payload).eq("id",existing.id).select("id").single();if(q.error)throw q.error;teamIds.set(normalizedKey(name,r.country),existing.id);result.updated++;await supabase.from("directory_change_log").insert({entity_type:"team",entity_id:existing.id,source_id:sourceId,action:"updated"});}
  else{const q=await supabase.from("teams").insert(payload).select("id").single();if(q.error)throw q.error;teamIds.set(normalizedKey(name,r.country),q.data.id);result.created++;await supabase.from("directory_change_log").insert({entity_type:"team",entity_id:q.data.id,source_id:sourceId,action:"created"});}
  if(leagueId && clean(r.season)){
 const teamId=existing?.id??teamIds.get(normalizedKey(name,r.country));
 if(teamId){
  const q=await supabase.from("team_league_memberships").upsert(
   {team_id:teamId,league_id:leagueId,season:clean(r.season),start_date:clean(r.startDate),end_date:clean(r.endDate),active:true},
   {onConflict:"team_id,league_id,season",ignoreDuplicates:true}
  );
  if(q.error)throw q.error;
 }
}
 }
 for(const r of directory.coaches){
  const name=clean(r.name);if(!name){result.skipped++;continue;}result.seen++;
  let teamId=r.teamExternalId?null:teamIds.get(normalizedKey(r.teamName||"",r.country));
  if(r.teamExternalId){const q=await supabase.from("teams").select("id").eq("source_id",sourceId).eq("external_id",clean(r.teamExternalId)).limit(2).maybeSingle();if(q.error)throw q.error;teamId=q.data?.id??null;}
  let existing:any=null;
  if(clean(r.externalId)){const q=await supabase.from("coaches").select("id").eq("source_id",sourceId).eq("external_id",clean(r.externalId)).limit(2).maybeSingle();if(q.error)throw q.error;existing=q.data;}
  if(!existing){const q=await supabase.from("coaches").select("id").ilike("name",literalName(name)).eq("country",clean(r.country)).limit(2).maybeSingle();if(q.error)throw q.error;existing=q.data;}
  const payload:any={name,country:clean(r.country),city:clean(r.city),current_team_id:teamId,external_id:clean(r.externalId),source_id:sourceId,last_synced_at:new Date().toISOString(),active:true};
  if(existing){const q=await supabase.from("coaches").update(payload).eq("id",existing.id).select("id").single();if(q.error)throw q.error;result.updated++;await supabase.from("directory_change_log").insert({entity_type:"coach",entity_id:existing.id,source_id:sourceId,action:"updated"});}
  else{const q=await supabase.from("coaches").insert(payload).select("id").single();if(q.error)throw q.error;existing=q.data;result.created++;await supabase.from("directory_change_log").insert({entity_type:"coach",entity_id:existing.id,source_id:sourceId,action:"created"});}
  if(teamId){
 const q=await supabase.from("coach_team_assignments").upsert(
  {coach_id:existing.id,team_id:teamId,role:clean(r.role),season:clean(r.season),start_date:clean(r.startDate),end_date:clean(r.endDate),active:true},
  {onConflict:"coach_id,team_id,season"}
 );
 if(q.error)throw q.error;
}
 }
 return result;
}
