// Advisory scheduling only. A verified shared rolling quota must still reserve each actual request.
export type LiveWindow = { start:number; end:number };
export type LiveCadenceInput = {
  now:number; windows:readonly LiveWindow[];
  // Operator-verified request allowance and actual ledger usage, never guessed from a plan name.
  enabled:boolean; dayLimit:number; usedLast24Hours:number; protectedOtherRequests:number;
  minIntervalMinutes:number;
};
export type LiveCadencePlan = {state:"disabled"|"invalid"|"no-capacity"|"no-active-window"} |
  {state:"planned"; intervalMinutes:number; slots:number[]; availableRequests:number; unallocatedRequests:number};
const minute=60_000,day=24*60*minute;
const nonnegative=(v:number)=>Number.isSafeInteger(v)&&v>=0;

/** One date-wide live request per slot, not one request per fixture.
 * Windows must be independently confirmed by the caller (not inferred from a scheduled tipoff).
 * Conservatively never count on quota resetting during the next 24 hours.
 * Preserve room for legacy invocations, schedule/standings work and manual requests.
 * No cron, provider calls, storage writes or implied SLA. */
export function planLiveCadence(input:LiveCadenceInput):LiveCadencePlan {
  const {now,windows,enabled,dayLimit,usedLast24Hours,protectedOtherRequests,minIntervalMinutes}=input;
  if(enabled!==true)return {state:"disabled"};
  if(![now,dayLimit,usedLast24Hours,protectedOtherRequests,minIntervalMinutes].every(nonnegative)||
    now>Number.MAX_SAFE_INTEGER-day||minIntervalMinutes<1||minIntervalMinutes>1440||
    !Array.isArray(windows)||windows.length>10000)return {state:"invalid"};
  const limit=now+day,availableRequests=Math.max(0,dayLimit-usedLast24Hours-protectedOtherRequests);
  if(windows.some(w=>!w||!nonnegative(w.start)||!nonnegative(w.end)||w.end<=w.start))return {state:"invalid"};
  if(!availableRequests)return {state:"no-capacity"};
  const merged:LiveWindow[]=[];
  for(const w of windows.filter(w=>w.end>now&&w.start<limit).map(w=>({start:Math.max(w.start,now),end:Math.min(w.end,limit)})).sort((a,b)=>a.start-b.start||a.end-b.end)){
    const last=merged[merged.length-1];
    if(last&&w.start<=last.end)last.end=Math.max(last.end,w.end);else merged.push(w);
  }
  const candidates:number[]=[];
  for(const w of merged){
    for(let t=Math.ceil(w.start/minute)*minute;t<w.end;t+=minute)candidates.push(t);
  }
  if(!candidates.length)return {state:"no-active-window"};
  const allocate=(interval:number)=>{
    const slots:number[]=[];
    for(const t of candidates){if(!slots.length||t-slots[slots.length-1]>=interval*minute)slots.push(t);}
    return slots;
  };
  // Greedy earliest-slot allocation is bounded by the minute grid (1440 points).
  // Select the fastest permitted interval that fits the conservative request allowance.
  for(let interval=minIntervalMinutes;interval<=1440;interval++){
    const slots=allocate(interval);
    if(slots.length<=availableRequests)return {state:"planned",intervalMinutes:interval,slots,availableRequests,unallocatedRequests:availableRequests-slots.length};
  }
  return {state:"no-capacity"};
}
