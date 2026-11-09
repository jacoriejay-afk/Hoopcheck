"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import TeamLeaguePicker from "./TeamLeaguePicker";
import { supabase } from "../lib/supabase";

type CareerStop = {
  id: string;
  player_id: string;
  team_id: string | null;
  team_name: string;
  league_name: string | null;
  country: string;
  seasons: string;
  position: string | null;
  stop_order: number;
  is_public: boolean;
};

const FLAGS: Record<string,string> = {
  "United States":"🇺🇸",Canada:"🇨🇦",Mexico:"🇲🇽",Spain:"🇪🇸",France:"🇫🇷",Germany:"🇩🇪",Italy:"🇮🇹",
  Greece:"🇬🇷",Türkiye:"🇹🇷",Turkey:"🇹🇷",Serbia:"🇷🇸",Croatia:"🇭🇷",Portugal:"🇵🇹",Poland:"🇵🇱",
  Lithuania:"🇱🇹",Latvia:"🇱🇻",Finland:"🇫🇮",Sweden:"🇸🇪",Belgium:"🇧🇪",Netherlands:"🇳🇱",Austria:"🇦🇹",
  Romania:"🇷🇴",Bulgaria:"🇧🇬",Hungary:"🇭🇺",Czechia:"🇨🇿","Czech Republic":"🇨🇿",Russia:"🇷🇺",
  Azerbaijan:"🇦🇿",Georgia:"🇬🇪",Israel:"🇮🇱",Lebanon:"🇱🇧",China:"🇨🇳",Japan:"🇯🇵",
  "South Korea":"🇰🇷",Philippines:"🇵🇭",Mongolia:"🇲🇳",Australia:"🇦🇺","New Zealand":"🇳🇿",
  Argentina:"🇦🇷",Brazil:"🇧🇷",Chile:"🇨🇱",Colombia:"🇨🇴",Egypt:"🇪🇬",Nigeria:"🇳🇬"
};
const monogram = (name:string) => name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase() || "HC";

export default function PlayerJourney({ playerId, isOwnProfile, canManage }: { playerId:string; isOwnProfile:boolean; canManage:boolean }) {
  const [stops,setStops] = useState<CareerStop[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");
  const [teamId,setTeamId] = useState("");
  const [careerStatus,setCareerStatus] = useState<"current"|"former">("former");
  const [teamName,setTeamName] = useState("");
  const [leagueName,setLeagueName] = useState("");
  const [country,setCountry] = useState("");
  const [seasons,setSeasons] = useState("");
  const [position,setPosition] = useState("");
  const [isPublic,setIsPublic] = useState(false);

  async function load() {
    const {data,error} = await supabase.from("player_career_stops")
      .select("id,player_id,team_id,team_name,league_name,country,seasons,position,stop_order,is_public")
      .eq("player_id",playerId).order("stop_order",{ascending:true}).order("created_at",{ascending:true});
    if(!error) setStops((data||[]) as CareerStop[]);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from("player_career_stops").select("id,player_id,team_id,team_name,league_name,country,seasons,position,stop_order,is_public").eq("player_id",playerId).order("stop_order",{ascending:true}).order("created_at",{ascending:true}),
    ]).then(([stopResult]) => {
      if(!active) return;
      if(!stopResult.error) setStops((stopResult.data||[]) as CareerStop[]);
      setLoading(false);
    }).catch(()=>{ if(active) setLoading(false); });
    return ()=>{active=false;};
  },[playerId]);

  const countryPassport = Array.from(new Set(stops.filter(stop => isOwnProfile || stop.is_public).map(stop => stop.country.trim()).filter(Boolean))).sort();

  async function addStop(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!canManage || saving) return;
    const name = teamName.trim();
    if(!name || !country.trim() || !seasons.trim()) { setMessage("Team, country, and seasons are required."); return; }
    setSaving(true); setMessage("");
    const {data:{user}} = await supabase.auth.getUser();
    if(!user || user.id!==playerId) { setMessage("Sign in to your own player account to update your journey."); setSaving(false); return; }
    const {error} = await supabase.from("player_career_stops").insert({
      player_id:playerId,team_id:teamId||null,team_name:name,league_name:leagueName.trim()||null,
      country:country.trim(),seasons:seasons.trim(),position:position.trim()||null,
      stop_order:stops.length,is_public:isPublic
    });
    if(error) setMessage(error.message.includes("row-level security") ? "My Journey requires an active Premium Player membership." : "Couldn't save this career stop. Please try again.");
    else {
      setTeamId("");setTeamName("");setLeagueName("");setCountry("");setSeasons("");setPosition("");setIsPublic(false);
      setMessage("Career stop added. Your passport countries are updated from your career history. Review eligibility is checked separately.");await load();
    }
    setSaving(false);
  }

  async function toggleVisibility(stop:CareerStop) {
    if(!canManage) return;
    const {error} = await supabase.from("player_career_stops").update({is_public:!stop.is_public,updated_at:new Date().toISOString()}).eq("id",stop.id).eq("player_id",playerId);
    if(error) { setMessage("Couldn't update this stop's visibility."); return; }
    setStops(current=>current.map(item=>item.id===stop.id?{...item,is_public:!item.is_public}:item));
  }

  async function removeStop(stop:CareerStop) {
    if(!canManage || !window.confirm("Remove this career stop from My Journey?")) return;
    const {error} = await supabase.from("player_career_stops").delete().eq("id",stop.id).eq("player_id",playerId);
    if(error) { setMessage("Couldn't remove this career stop."); return; }
    setStops(current=>current.filter(item=>item.id!==stop.id));
    setMessage("Career stop removed.");
  }

  return <section className="hc-journey-section">
    <div className="hc-journey-heading"><div><p className="eyebrow">CAREER PASSPORT</p><h2>My Journey<span>.</span></h2><p>Every stop tells part of the story.</p></div><span className="hc-journey-stamp">PLAYER<br/>HISTORY</span></div>
    {!loading && countryPassport.length > 0 && <div className="hc-journey-countries" aria-label="Countries played in"><strong>COUNTRIES PLAYED IN · {countryPassport.length}</strong><div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>{countryPassport.map(name=><span key={name} className="hc-journey-country" style={{padding:"6px 10px",border:"1px solid var(--hc-border, #777)",borderRadius:10}}>{FLAGS[name]||"🌍"} {name}</span>)}</div></div>}
    {loading ? <p className="muted">Loading career stops…</p> : stops.length ? <div className="hc-journey-timeline">
      {stops.map((stop,index) => <article className="hc-journey-stop" key={stop.id}>
        <div className="hc-journey-stop__rail"><span className="hc-journey-stop__dot">{String(index+1).padStart(2,"0")}</span>{index<stops.length-1&&<span className="hc-journey-stop__line"/>}</div>
        <div className="hc-journey-stop__card">
          <div className="hc-journey-stop__top"><span className="hc-journey-stop__flag" aria-label={stop.country}>{FLAGS[stop.country]||"🌍"}</span><span className="hc-journey-stop__season">{stop.seasons}</span>{stop.is_public&&<span className="hc-journey-public">PUBLIC</span>}</div>
          <div className="hc-journey-stop__team"><span className="hc-journey-stop__crest">{monogram(stop.team_name)}</span><div><h3>{stop.team_name}</h3><p>{stop.league_name||"League not listed"} · {stop.country}</p>{stop.position&&<small>Position · {stop.position}</small>}</div></div>
          <div className="hc-journey-stop__footer">
            {stop.team_id ? <><Link href={`/teams/${stop.team_id}`}>View team profile →</Link>{isOwnProfile&&<Link href={`/teams/${stop.team_id}/review`}>Check review eligibility →</Link>}</> : <span className="muted">Team not linked to directory — request a listing to review</span>}
            {isOwnProfile&&canManage&&<div><button type="button" onClick={()=>void toggleVisibility(stop)}>{stop.is_public?"Make private":"Make public"}</button><button type="button" onClick={()=>void removeStop(stop)}>Remove</button></div>}
          </div>
        </div>
      </article>)}
    </div> : <div className="hc-journey-empty"><span>01 / CAREER PASSPORT</span><h3>No career stops added yet</h3><p>Build a timeline of the teams, leagues, countries, seasons, and positions that shaped your career.</p></div>}
    {isOwnProfile&&!canManage&&<div className="hc-journey-upgrade"><strong>Premium Players · My Journey</strong><p>Add career stops and create your professional basketball passport. Public sharing is always optional.</p><Link href="/membership" className="btn">Unlock My Journey</Link></div>}
    {isOwnProfile&&canManage&&<form className="hc-journey-form" onSubmit={addStop}>
      <p className="eyebrow">ADD CAREER STOP</p>
      <label>Current or former team <select value={careerStatus} onChange={event=>setCareerStatus(event.target.value as "current"|"former")}><option value="current">Current team</option><option value="former">Former team</option></select></label>
      <TeamLeaguePicker mode="team" directorySource="both" allCategories label="Match a HoopCheck team" placeholder="Search current or former club" value={teamId} onChange={setTeamId} onSelectItem={item=>{setTeamId(item.id);setTeamName(item.name);setCountry(item.country);setLeagueName(item.league_name||"");}} />
      <p className="muted">Select a team to fill in its country and league. {careerStatus==="current"?"Enter the current season below.":"Enter the season(s) you previously played."} Adding a team does not automatically verify eligibility to publish a review.</p>
      <label>Team name <input value={teamName} onChange={event=>setTeamName(event.target.value)} maxLength={160} required placeholder="Team or club name"/></label>
      <label>League <input value={leagueName} onChange={event=>setLeagueName(event.target.value)} maxLength={160} placeholder="League name"/></label>
      <div className="hc-journey-form__row"><label>Country <input value={country} onChange={event=>setCountry(event.target.value)} maxLength={100} required placeholder="Country"/></label><label>Seasons <input value={seasons} onChange={event=>setSeasons(event.target.value)} maxLength={80} required placeholder="2024–25"/></label></div>
      <label>Position <input value={position} onChange={event=>setPosition(event.target.value)} maxLength={60} placeholder="Point guard, wing…"/></label>
      <label className="hc-journey-public-toggle"><input type="checkbox" checked={isPublic} onChange={event=>setIsPublic(event.target.checked)}/><span><strong>Show this stop publicly</strong><small>Off by default. Only this career stop becomes visible on your public profile.</small></span></label>
      {message&&<p role="status" className="muted">{message}</p>}
      <button type="submit" className="btn" disabled={saving}>{saving?"Saving…":"Add Career Stop"}</button>
    </form>}
  </section>;
}
