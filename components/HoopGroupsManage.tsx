"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

export type GroupSpace = {
  id:string; slug:string; name:string; category:string; description:string;
  owner_id:string|null; accent_color:string; icon_key:string;
};
export type GroupChannel = {id:string;space_id:string;slug:string;name:string;sort_index:number};
export const GROUP_COLORS:Record<string,string> = {
  orange:"#ff652a",blue:"#397dff",purple:"#9257e9",green:"#21a87a",pink:"#eb5898",gold:"#d59521"
};
export const GROUP_ICONS:Record<string,string> = {
  basketball:"🏀",flame:"🔥",globe:"🌎",star:"⭐",trophy:"🏆",users:"👥"
};
const CATEGORIES = [
  ["global","Basketball"],["players","Players"],["fans","Fans"],["coaches","Coaches"],
  ["agents","Agents & Scouts"],["womens","Women’s hoops"]
] as const;
const slugify=(text:string)=>text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40).replace(/-+$/g,"");
type Mode="closed"|"create"|"edit"|"channel"|"rename";
type Props={
  userId:string; selected:GroupSpace|null; channels:GroupChannel[];
  onCreated:(created:GroupSpace)=>Promise<void>;
  onUpdated:(updated:GroupSpace)=>void;
  onChannelCreated:(created:GroupChannel)=>void;
  onChannelUpdated:(id:string,name:string)=>void;
};

export default function HoopGroupsManage({userId,selected,channels,onCreated,onUpdated,onChannelCreated,onChannelUpdated}:Props) {
  const [mode,setMode]=useState<Mode>("closed");
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [category,setCategory]=useState("global");
  const [accent,setAccent]=useState("orange");
  const [icon,setIcon]=useState("basketball");
  const [channelName,setChannelName]=useState("");
  const [channelId,setChannelId]=useState("");
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState("");
  const accountRef=useRef(userId);
  useEffect(()=>{accountRef.current=userId;setMode("closed");setFeedback("");},[userId,selected?.id]);

  const isOwner=Boolean(selected?.owner_id && selected.owner_id===userId);
  function changeMode(next:Mode) {
    setMode(next);setBusy(false);setFeedback("");
    if(next==="edit" && selected) {
      setName(selected.name);setDescription(selected.description);setCategory(selected.category);
      setAccent(selected.accent_color||"orange");setIcon(selected.icon_key||"basketball");
    } else if(next==="create") {
      setName("");setDescription("");setCategory("global");setAccent("orange");setIcon("basketball");
    } else if(next==="channel") setChannelName("");
    else if(next==="rename") {setChannelId(channels[0]?.id||"");setChannelName(channels[0]?.name||"");}
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy || !userId) return;
    if((mode==="edit"||mode==="channel"||mode==="rename")&&!isOwner) return;
    const cleanName=(mode==="channel"||mode==="rename"?channelName:name).trim().replace(/\s+/g," ");
    if(cleanName.length<2 || cleanName.length>(mode==="channel"||mode==="rename"?50:80) ||
       (mode==="create"||mode==="edit") && cleanName.length<3) {
      setFeedback("Use a longer name within the allowed limit.");return;
    }
    const initialUser=userId;
    setBusy(true);setFeedback("");
    try {
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id!==initialUser || accountRef.current!==initialUser) return;
      if(mode==="create") {
        const base=slugify(cleanName)||"court";
        const slug=(base+"-"+crypto.randomUUID().slice(0,8)).slice(0,60);
        const {data,error}=await supabase.from("hoop_group_spaces")
          .insert({slug,name:cleanName,description:description.trim().slice(0,300),category,
            owner_id:initialUser,accent_color:accent,icon_key:icon})
          .select("id,slug,name,category,description,owner_id,accent_color,icon_key").single();
        if(error || !data) throw new Error("Could not create this server. You can own up to three, and each server needs a unique name.");
        if(accountRef.current!==initialUser) return;
        await onCreated(data as GroupSpace);
        setMode("closed");
      } else if(mode==="edit" && selected) {
        const {data,error}=await supabase.from("hoop_group_spaces")
          .update({name:cleanName,description:description.trim().slice(0,300),accent_color:accent,icon_key:icon})
          .eq("id",selected.id).eq("owner_id",initialUser)
          .select("id,slug,name,category,description,owner_id,accent_color,icon_key").single();
        if(error || !data) throw new Error("Could not save server settings.");
        if(accountRef.current!==initialUser) return;
        onUpdated(data as GroupSpace);setMode("closed");
      } else if(mode==="channel" && selected) {
        if(channels.length>=12) throw new Error("This server already has the maximum 12 channels.");
        const slug=slugify(cleanName).slice(0,40);
        if(slug.length<2) throw new Error("Channel name needs at least two letters or numbers.");
        const {data,error}=await supabase.from("hoop_group_channels")
          .insert({space_id:selected.id,name:cleanName,slug,sort_index:channels.length})
          .select("id,space_id,slug,name,sort_index").single();
        if(error || !data) throw new Error("Channel could not be created. Try a different name.");
        if(accountRef.current!==initialUser) return;
        onChannelCreated(data as GroupChannel);setMode("closed");
      } else if(mode==="rename" && selected) {
        const channel=channels.find(item=>item.id===channelId);
        if(!channel) throw new Error("Choose a channel first.");
        const {data,error}=await supabase.from("hoop_group_channels")
          .update({name:cleanName}).eq("id",channel.id).eq("space_id",selected.id)
          .select("id").single();
        if(error || !data) throw new Error("Could not rename that channel.");
        if(accountRef.current!==initialUser) return;
        onChannelUpdated(channel.id,cleanName);setMode("closed");
      }
    } catch(error) {
      if(accountRef.current===initialUser) setFeedback(error instanceof Error?error.message:"Could not save changes.");
    } finally {if(accountRef.current===initialUser) setBusy(false);}
  }

  return <section className="hc-groups-management" aria-label="Community creation and settings">
    <div className="hc-groups-management-actions">
      <button type="button" onClick={()=>changeMode(mode==="create"?"closed":"create")} aria-expanded={mode==="create"}>+ Create server</button>
      {isOwner&&<><button type="button" onClick={()=>changeMode(mode==="edit"?"closed":"edit")} aria-expanded={mode==="edit"}>Server settings</button>
        <button type="button" onClick={()=>changeMode(mode==="channel"?"closed":"channel")} aria-expanded={mode==="channel"}>+ Add channel</button>
        <button type="button" onClick={()=>changeMode(mode==="rename"?"closed":"rename")} aria-expanded={mode==="rename"}>Rename channel</button></>}
    </div>
    {mode!=="closed"&&<form className="hc-groups-manage-form" onSubmit={event=>void submit(event)}>
      <h3>{mode==="create"?"Create a basketball server":mode==="edit"?"Customize your server":mode==="channel"?"Create a text channel":"Rename a text channel"}</h3>
      {(mode==="create"||mode==="edit")&&<>
        <label>Server name<input value={name} onChange={event=>setName(event.target.value)} maxLength={80} required minLength={3} placeholder="e.g. Overseas Hoopers"/></label>
        <label>Description<textarea rows={2} maxLength={300} value={description} onChange={event=>setDescription(event.target.value)} placeholder="Who should join this basketball community?"/></label>
        {mode==="create"&&<label>Topic<select value={category} onChange={event=>setCategory(event.target.value)}>{CATEGORIES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
        <fieldset><legend>Server icon</legend><div className="hc-groups-icon-choices">{Object.entries(GROUP_ICONS).map(([key,emoji])=><button key={key} type="button" aria-label={key} aria-pressed={icon===key} onClick={()=>setIcon(key)}>{emoji}</button>)}</div></fieldset>
        <fieldset><legend>Server accent color</legend><div className="hc-groups-color-choices">{Object.entries(GROUP_COLORS).map(([key,color])=><button key={key} type="button" aria-label={key} title={key} aria-pressed={accent===key} onClick={()=>setAccent(key)} style={{"--group-swatch":color} as CSSProperties}><span/></button>)}</div></fieldset>
      </>}
      {(mode==="channel"||mode==="rename")&&<>
        {mode==="rename"&&<label>Channel<select value={channelId} onChange={event=>{setChannelId(event.target.value);setChannelName(channels.find(c=>c.id===event.target.value)?.name||"");}}>{channels.map(c=><option value={c.id} key={c.id}># {c.name}</option>)}</select></label>}
        <label>Channel name<input value={channelName} onChange={event=>setChannelName(event.target.value)} maxLength={50} minLength={2} required placeholder="e.g. training-tips"/></label>
        <p className="muted">Channel messages remain moderated. Only server owners can manage channels.</p>
      </>}
      {mode==="create"&&<p className="muted">You can own up to 3 communities. New servers include #welcome, #general and #game-talk. Members join voluntarily.</p>}
      {feedback&&<p role="alert">{feedback}</p>}
      <div className="hc-groups-manage-form-actions"><button type="button" disabled={busy} onClick={()=>changeMode("closed")}>Cancel</button><button className="btn" type="submit" disabled={busy}>{busy?"Saving…":mode==="create"?"Create server":"Save changes"}</button></div>
    </form>}
  </section>;
}
