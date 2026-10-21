"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "./LanguageProvider";

type Spot={id:string;team_id:string;created_by:string;title:string;description:string|null;season:string|null;status:"open"|"closed";expires_at:string|null;created_at:string};

export default function TeamRosterSpots({teamId,teamName}:{teamId:string;teamName:string}) {
  const { formatDate } = useLanguage();
  const [spots,setSpots]=useState<Spot[]>([]);
  const [canPost,setCanPost]=useState(false);
  const [open,setOpen]=useState(false);
  const [title,setTitle]=useState("");
  const [season,setSeason]=useState("");
  const [description,setDescription]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load() {
    const {data,error}=await supabase.from("team_roster_spots").select("id,team_id,created_by,title,description,season,status,expires_at,created_at")
      .eq("team_id",teamId).eq("status","open").order("created_at",{ascending:false}).limit(20);
    if(!error)setSpots((data||[]) as Spot[]);
  }
  useEffect(()=>{
    let active=true;
    void (async()=>{
      const {data:{session}}=await supabase.auth.getSession();
      if(session?.user){
        const {data:claim}=await supabase.from("profile_claim_requests").select("id").eq("requester_id",session.user.id).eq("entity_type","team").eq("entity_id",teamId).eq("status","approved").maybeSingle();
        if(active)setCanPost(Boolean(claim));
      }
      const {data,error}=await supabase.from("team_roster_spots").select("id,team_id,created_by,title,description,season,status,expires_at,created_at")
        .eq("team_id",teamId).eq("status","open").order("created_at",{ascending:false}).limit(20);
      if(active&&!error)setSpots((data||[]) as Spot[]);
    })();
    return ()=>{active=false;};
  },[teamId]);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!canPost||busy)return;
    if(title.trim().length<3){setMessage("Add a clear roster opportunity title.");return;}
    setBusy(true);setMessage("");
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setMessage("Sign in with the approved team account.");setBusy(false);return;}
    const {error}=await supabase.from("team_roster_spots").insert({team_id:teamId,created_by:user.id,title:title.trim(),season:season.trim()||null,description:description.trim()||null,status:"open"});
    if(error)setMessage("Could not post this roster spot. Please try again.");
    else {setTitle("");setSeason("");setDescription("");setOpen(false);setMessage("Roster opportunity posted. Team watchers may receive an alert.");await load();}
    setBusy(false);
  }

  return <section className="hc-roster-spots">
    <div className="hc-roster-spots__heading"><div><p className="eyebrow">ROSTER BOARD</p><h2>Open roster spots<span>.</span></h2></div>{canPost&&<button type="button" className="hc-roster-post-toggle" onClick={()=>setOpen(value=>!value)}>{open?"Cancel":"+ Post a spot"}</button>}</div>
    {spots.length?<div className="hc-roster-spots__list">{spots.map(spot=><article key={spot.id} className="hc-roster-spot"><span className="hc-roster-spot__badge">OPEN</span><h3>{spot.title}</h3>{spot.season&&<small>Season · {spot.season}</small>}{spot.description&&<p>{spot.description}</p>}<small>Posted {formatDate(spot.created_at)}</small></article>)}</div>
      :<p className="hc-roster-spots__empty">No open roster spots have been posted for {teamName}.</p>}
    {open&&canPost&&<form className="hc-roster-post-form" onSubmit={submit}><label>Position / opportunity title<input value={title} onChange={event=>setTitle(event.target.value)} required maxLength={160} placeholder="Import guard · 2026–27 season"/></label><label>Season<input value={season} onChange={event=>setSeason(event.target.value)} maxLength={80} placeholder="2026–27"/></label><label>Details<textarea value={description} onChange={event=>setDescription(event.target.value)} maxLength={2000} rows={3} placeholder="Role, requirements, contact instructions…"/></label>{message&&<p role="status">{message}</p>}<button type="submit" className="btn" disabled={busy}>{busy?"Posting…":"Publish Roster Spot"}</button></form>}
    {!open&&message&&<p role="status" className="muted">{message}</p>}
  </section>;
}
