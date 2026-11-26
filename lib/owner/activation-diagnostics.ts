/** Aggregates existing web page-view observations; not a verified conversion or app activation metric. */
export const DAY=86400000;
export const MIN_COHORT=10;
export const MAX_COHORT=200;
export const MAX_EVENTS=5000;
type Profile={id:string;created_at:string};
type Visit={user_id:string|null;created_at:string;path:string|null};
const researchPath=/^\/(?:pre-sign|teams(?:\/[0-9a-f-]{36})?|leagues(?:\/[0-9a-f-]{36})?|womens(?:\/[0-9a-f-]{36})?)\/?$/i;
export function activationWindow(now:number){
 if(!Number.isFinite(now))throw Error("Invalid observation time");
 const end=Math.floor(now/DAY)*DAY-7*DAY;
 return {start:new Date(end-7*DAY).toISOString(),end:new Date(end).toISOString(),observationEnd:new Date(end+7*DAY).toISOString()};
}
export function aggregateWebActivation(profiles:readonly Profile[],events:readonly Visit[]){
 if(profiles.length<MIN_COHORT||profiles.length>MAX_COHORT||events.length>MAX_EVENTS)return null;
 const cohort=new Map<string,number>();
 for(const p of profiles){const t=Date.parse(p.created_at);if(!Number.isFinite(t)||cohort.has(p.id))return null;cohort.set(p.id,t);}
 const visited=new Set<string>();
 for(const event of events){
  if(!event.user_id||!event.path||!researchPath.test(event.path))continue;
  const start=cohort.get(event.user_id),at=Date.parse(event.created_at);
  if(start!==undefined&&Number.isFinite(at)&&at>=start&&at<start+7*DAY)visited.add(event.user_id);
 }
 // Suppress both complementary small cells. A small cell is not a zero.
 if(visited.size<MIN_COHORT||profiles.length-visited.size<MIN_COHORT)return {profiles:profiles.length,observed:null};
 return {profiles:profiles.length,observed:visited.size};
}
