/** Read-only launch review packet. Never authorizes or executes deployment. */
export const launchStages=["internal","closed_beta","controlled_release","expansion"] as const;
type Stage=typeof launchStages[number];
export const launchGates=["technical","store","privacy_legal","support_moderation","incident_rollback","tester_consent","owner_scope"] as const;
type Gate=typeof launchGates[number];
const DAY=86400000;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const only=(v:Record<string,unknown>,keys:readonly string[])=>Object.keys(v).every(k=>keys.includes(k));
const sha=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{40}$/.test(v);
const label=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(v);
const date=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const evidence=(v:unknown):v is string=>typeof v==="string"&&/^https:\/\/github\.com\/jacoriejay-afk\/Hoopcheck\/(?:actions\/runs\/\d+|pull\/\d+|issues\/\d+|blob\/[a-f0-9]{40}\/[A-Za-z0-9._/-]+)(?:#[A-Za-z0-9_-]+)?$/.test(v);
const isStage=(v:unknown):v is Stage=>typeof v==="string"&&(launchStages as readonly string[]).includes(v);
const isGate=(v:unknown):v is Gate=>typeof v==="string"&&(launchGates as readonly string[]).includes(v);
const recent=(v:unknown,now:number):v is string=>date(v)&&Date.parse(v)<=now&&now-Date.parse(v)<=7*DAY;
type Decision={state:"HOLD"|"PACKET_COMPLETE_REVIEW_REQUIRED";stage:Stage|null;blocked:string[];passed:Gate[]};
export function evaluateLaunchPacket(raw:string|undefined,candidate:string|undefined,now=Date.now()):Decision{
 const invalid=(reason:string):Decision=>({state:"HOLD",stage:null,blocked:[reason],passed:[]});
 if(!sha(candidate)||!Number.isFinite(now))return invalid("candidate_unverified");
 if(!raw||raw.length>16000)return invalid("packet_missing_or_oversized");
 try{
  const v:unknown=JSON.parse(raw);
  if(!record(v)||!only(v,["sha","iosBuild","androidBuild","stage","openP0","openP1","observedAt","previousStage","gates"])||v.sha!==candidate||!label(v.iosBuild)||!label(v.androidBuild)||!isStage(v.stage)||!recent(v.observedAt,now)||!Number.isSafeInteger(v.openP0)||typeof v.openP0!=="number"||v.openP0<0||!Number.isSafeInteger(v.openP1)||typeof v.openP1!=="number"||v.openP1<0||!Array.isArray(v.gates)||v.gates.length>launchGates.length)return invalid("invalid_or_stale_packet");
  const stage=v.stage,stageIndex=launchStages.indexOf(stage);
  const blocked:string[]=[];
  if(v.openP0!==0||v.openP1!==0)blocked.push("open_critical_or_major_incidents");
  if(stageIndex>0){
   const prior=v.previousStage;
   if(!record(prior)||!only(prior,["stage","windowStart","windowEnd","evidence","reviewer"])||prior.stage!==launchStages[stageIndex-1]||!date(prior.windowStart)||!recent(prior.windowEnd,now)||Date.parse(prior.windowEnd)-Date.parse(prior.windowStart)<(stageIndex===1?0:7*DAY)||Date.parse(prior.windowEnd)<=Date.parse(prior.windowStart)||!evidence(prior.evidence)||!label(prior.reviewer))blocked.push("previous_stage_review_missing");
  }else if(v.previousStage!==null)return invalid("unexpected_previous_stage");
  const seen=new Set<Gate>(),passed=new Set<Gate>();
  for(const item of v.gates){
   if(!record(item)||!only(item,["gate","sha","iosBuild","androidBuild","stage","result","evidence","reviewer","checkedAt"])||!isGate(item.gate)||seen.has(item.gate))return invalid("invalid_or_duplicate_gate");
   seen.add(item.gate);
   if(item.sha===candidate&&item.iosBuild===v.iosBuild&&item.androidBuild===v.androidBuild&&item.stage===stage&&item.result==="pass"&&evidence(item.evidence)&&label(item.reviewer)&&recent(item.checkedAt,now))passed.add(item.gate);
  }
  for(const gate of launchGates)if(!passed.has(gate))blocked.push(gate);
  return {state:blocked.length?"HOLD":"PACKET_COMPLETE_REVIEW_REQUIRED",stage,blocked,passed:[...passed]};
 }catch{return invalid("invalid_packet");}
}
