export type ChatRequest = {
  id:string; requester_id:string; player_id:string; message:string|null;
  status:string; created_at:string;
};
export type ChatMessage = {id:string; request_id:string; sender_id:string; body:string; created_at:string};
export type ChatContact = {id:string;display_name:string|null;username:string|null;account_type:string|null};
export type ChatAppearance = {
  layout:"courtside"|"classic"; density:"comfortable"|"compact";
  scale:"normal"|"large"; accent:"orange"|"blue"|"purple";
};
export type ThreadPreferences = {pinned:string[];muted:string[];seen:Record<string,string>};
export const DEFAULT_APPEARANCE:ChatAppearance={
  layout:"courtside",density:"comfortable",scale:"normal",accent:"orange"
};
export const STARTERS=[
 {key:"introduce",label:"Break the ice",emoji:"👋",message:"Hey! Glad we connected on HoopCheck. How's your season going?"},
 {key:"film",label:"Film room",emoji:"🎥",message:"Would you be open to sharing game film or highlights?"},
 {key:"opportunity",label:"Opportunity talk",emoji:"🏀",message:"I'd like to connect about basketball opportunities. Is this a good time?"},
 {key:"game",label:"Game day",emoji:"🔥",message:"Did you catch the latest games? What matchup are you following?"}
] as const;
const valid=(v:unknown,values:readonly string[],fallback:string)=>typeof v==="string"&&values.includes(v)?v:fallback;
export function parseAppearance(raw:string|null):ChatAppearance{
  if(!raw)return {...DEFAULT_APPEARANCE};
  try{
    const value=JSON.parse(raw);
    if(!value||typeof value!=="object")return {...DEFAULT_APPEARANCE};
    return {
      layout:valid(value.layout,["courtside","classic"],"courtside") as ChatAppearance["layout"],
      density:valid(value.density,["comfortable","compact"],"comfortable") as ChatAppearance["density"],
      scale:valid(value.scale,["normal","large"],"normal") as ChatAppearance["scale"],
      accent:valid(value.accent,["orange","blue","purple"],"orange") as ChatAppearance["accent"]
    };
  }catch{return {...DEFAULT_APPEARANCE};}
}
export function parseThreadPreferences(raw:string|null):ThreadPreferences{
  const empty:ThreadPreferences={pinned:[],muted:[],seen:{}};
  if(!raw)return empty;
  try{
    const o=JSON.parse(raw);
    if(!o||typeof o!=="object")return empty;
    const ids=(a:unknown)=>Array.isArray(a)?a.filter((id:unknown):id is string=>typeof id==="string"&&/^[a-f\d-]{36}$/i.test(id)).slice(0,200):[];
    const seen:Record<string,string>={};
    if(o.seen&&typeof o.seen==="object") for(const [id,value] of Object.entries(o.seen)){
      if(/^[a-f\d-]{36}$/i.test(id)&&typeof value==="string"&&!Number.isNaN(Date.parse(value)))seen[id]=value;
    }
    return {pinned:ids(o.pinned),muted:ids(o.muted),seen};
  }catch{return empty;}
}
export function lastByThread(messages:ChatMessage[]){
  const map=new Map<string,ChatMessage>();
  for(const m of messages){
    const prior=map.get(m.request_id);
    if(!prior||prior.created_at<m.created_at)map.set(m.request_id,m);
  }
  return map;
}
export function unreadCount(request:ChatRequest,messages:ChatMessage[],me:string,lastSeen:string|undefined){
  if(request.status!=="accepted")return request.status==="pending"&&request.player_id===me?1:0;
  return messages.filter(m=>m.request_id===request.id&&m.sender_id!==me
    &&(!lastSeen||m.created_at>lastSeen)).length;
}
export function sortThreads(rows:ChatRequest[],last:Map<string,ChatMessage>,pinned:string[]){
  const pins=new Set(pinned);
  return [...rows].sort((a,b)=>Number(pins.has(b.id))-Number(pins.has(a.id))
    ||(last.get(b.id)?.created_at||b.created_at).localeCompare(last.get(a.id)?.created_at||a.created_at));
}
