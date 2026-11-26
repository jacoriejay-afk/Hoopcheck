import "server-only";
import { ambassadorDb } from "../ambassador/server";
import { activationWindow, aggregateWebActivation, MIN_COHORT, MAX_COHORT, MAX_EVENTS } from "./activation-diagnostics";
/** Only aggregate, existing data. Do not enable before retention/consent review. */
export async function readActivationDiagnostics(now=Date.now()){
 if(process.env.HOOPCHECK_ACTIVATION_DIAGNOSTICS_ENABLED!=="true")return {state:"disabled" as const};
 const window=activationWindow(now);
 const db=ambassadorDb();
 const profiles=await db.from("profiles").select("id,created_at").gte("created_at",window.start).lt("created_at",window.end).order("id").limit(MAX_COHORT+1);
 if(profiles.error||!profiles.data)return {state:"unavailable" as const};
 if(profiles.data.length>MAX_COHORT||profiles.data.length<MIN_COHORT)return {state:"unavailable" as const};
 const ids=profiles.data.map(p=>p.id);
 const visits: {user_id:string|null;created_at:string;path:string|null}[]=[];
 // Bound every batch below the default PostgREST maximum response and fail closed at cap.
 const batchSize=20,perBatchLimit=500;
 for(let i=0;i<ids.length;i+=batchSize){
  const result=await db.from("analytics_events").select("user_id,created_at,path")
   .in("user_id",ids.slice(i,i+batchSize)).eq("event_name","page_view").contains("metadata",{source:"web"})
   .gte("created_at",window.start).lt("created_at",window.observationEnd).order("id").limit(perBatchLimit+1);
  if(result.error||!result.data||result.data.length>perBatchLimit)return {state:"unavailable" as const};
  visits.push(...result.data);
  if(visits.length>MAX_EVENTS)return {state:"unavailable" as const};
 }
 const result=aggregateWebActivation(profiles.data,visits);
 if(!result)return {state:"unavailable" as const};
 return {state:"available" as const,window,...result};
}
