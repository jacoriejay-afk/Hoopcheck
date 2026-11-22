"use client";

import { useEffect, useState } from "react";

export type ChatPrefs = {density:"cozy"|"compact";style:"cards"|"plain";scale:"normal"|"large"};
const defaults:ChatPrefs={density:"cozy",style:"cards",scale:"normal"};
const storageKey=(userId:string,spaceId:string)=>"hc-hoopgroups-chat-v1:"+userId+":"+spaceId;
function restore(raw:string|null):ChatPrefs {
  if(!raw) return {...defaults};
  try {
    const value=JSON.parse(raw) as Partial<ChatPrefs>;
    return {
      density:value.density==="compact"?"compact":"cozy",
      style:value.style==="plain"?"plain":"cards",
      scale:value.scale==="large"?"large":"normal"
    };
  } catch {return {...defaults};}
}

export default function HoopGroupsChatSettings({userId,spaceId,onChange}:{
 userId:string;spaceId:string;onChange:(prefs:ChatPrefs)=>void;
}) {
  const [open,setOpen]=useState(false);
  const [prefs,setPrefs]=useState<ChatPrefs>({...defaults});
  useEffect(()=>{
    setOpen(false);
    let next={...defaults};
    if(userId && spaceId && typeof window!=="undefined") {
      try {next=restore(window.localStorage.getItem(storageKey(userId,spaceId)));}
      catch {next={...defaults};}
    }
    setPrefs(next);onChange(next);
  },[userId,spaceId,onChange]);
  function update<K extends keyof ChatPrefs>(key:K,value:ChatPrefs[K]) {
    const next={...prefs,[key]:value};
    setPrefs(next);onChange(next);
    if(!userId||!spaceId) return;
    try {window.localStorage.setItem(storageKey(userId,spaceId),JSON.stringify(next));}
    catch { /* In private mode, preferences still work for this session. */ }
  }
  return <div className="hc-groups-chat-settings">
    <button className="hc-groups-chat-settings-toggle" type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>Customize chat <span aria-hidden="true">⚙</span></button>
    {open&&<div className="hc-groups-chat-settings-panel" aria-label="Chat appearance options">
      <fieldset><legend>Message layout</legend><div className="hc-groups-segments">{(["cards","plain"] as const).map(value=><button key={value} type="button" aria-pressed={prefs.style===value} onClick={()=>update("style",value)}>{value==="cards"?"Bubbles":"Classic"}</button>)}</div></fieldset>
      <fieldset><legend>Spacing</legend><div className="hc-groups-segments">{(["cozy","compact"] as const).map(value=><button key={value} type="button" aria-pressed={prefs.density===value} onClick={()=>update("density",value)}>{value==="cozy"?"Comfortable":"Compact"}</button>)}</div></fieldset>
      <fieldset><legend>Text size</legend><div className="hc-groups-segments">{(["normal","large"] as const).map(value=><button key={value} type="button" aria-pressed={prefs.scale===value} onClick={()=>update("scale",value)}>{value==="normal"?"Default":"Large"}</button>)}</div></fieldset>
      <p>Saved for this account and server on this device.</p>
    </div>}
  </div>;
}
