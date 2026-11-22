"use client";

import { useEffect, useMemo, useState, type FormEvent, type CSSProperties } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import PlayerPassportExport from "./PlayerPassportExport";
import TeamLeaguePicker from "./TeamLeaguePicker";

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

// Only saved career stops produce stamps; never infer them from a player's location or nationality.
function normalizePassportCountry(country:string) {
  const clean = country.trim().replace(/\s+/g, " ");
  const key = clean.toLocaleLowerCase("en");
  if (key === "turkey" || key === "türkiye") return "Türkiye";
  if (key === "czech republic" || key === "czechia") return "Czechia";
  return clean;
}


export default function PlayerJourney({ playerId, isOwnProfile, canManage, playerName, verifiedPlayer }: { playerId:string; isOwnProfile:boolean; canManage:boolean; playerName:string; verifiedPlayer:boolean }) {
  const [stops,setStops] = useState<CareerStop[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");
  const [teamId,setTeamId] = useState("");
  const [editingStop,setEditingStop] = useState(false);
  const [manualTeam,setManualTeam] = useState(false);
  const [matchingStop,setMatchingStop] = useState<string|null>(null);
  const [matching,setMatching] = useState(false);
  const [reviewedTeams,setReviewedTeams] = useState<Record<string,string>>({});
  const [teamName,setTeamName] = useState("");
  const [leagueName,setLeagueName] = useState("");
  const [country,setCountry] = useState("");
  const [seasons,setSeasons] = useState("");
  const [position,setPosition] = useState("");
  const [isPublic,setIsPublic] = useState(false);
  // Retain the RLS boundary and filter again to prevent public view of private entries.
  const visibleStops = useMemo(() => isOwnProfile ? stops : stops.filter(stop => stop.is_public), [stops, isOwnProfile]);
  const stamps = useMemo(() => {
    const countries = new Map<string,{country:string;teams:string[];seasons:string[];privateCount:number}>();
    for (const stop of visibleStops) {
      const country = normalizePassportCountry(stop.country || "");
      if (!country) continue;
      const key = country.toLocaleLowerCase("en");
      let stamp = countries.get(key);
      if (!stamp) {
        stamp = {country,teams:[],seasons:[],privateCount:0};
        countries.set(key,stamp);
      }
      const team = stop.team_name?.trim();
      const season = stop.seasons?.trim();
      if (team && !stamp.teams.includes(team)) stamp.teams.push(team);
      if (season && !stamp.seasons.includes(season)) stamp.seasons.push(season);
      if (!stop.is_public) stamp.privateCount++;
    }
    return [...countries.values()];
  },[visibleStops]);

  async function load() {
    const {data,error} = await supabase.from("player_career_stops")
      .select("id,player_id,team_id,team_name,league_name,country,seasons,position,stop_order,is_public")
      .eq("player_id",playerId).order("stop_order",{ascending:true}).order("created_at",{ascending:true});
    if(!error) setStops((data||[]) as CareerStop[]);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const {data,error} = await supabase.from("player_career_stops")
          .select("id,player_id,team_id,team_name,league_name,country,seasons,position,stop_order,is_public")
          .eq("player_id",playerId).order("stop_order",{ascending:true}).order("created_at",{ascending:true});
        if(active && !error) setStops((data||[]) as CareerStop[]);
      } catch {
        // A failed optional career read must not block the rest of the profile.
      } finally {
        if(active) setLoading(false);
      }
    })();
    return ()=>{active=false;};
  },[playerId]);

  useEffect(() => {
    if(!isOwnProfile) return;
    let active = true;
    setReviewedTeams({});
    void supabase.auth.getUser().then(async ({data:{user}}) => {
      if(!active || user?.id!==playerId) return;
      const {data,error} = await supabase.from("reviews").select("team_id,status").eq("author_id",playerId).not("team_id","is",null);
      if(!active || error) return;
      setReviewedTeams(Object.fromEntries((data||[]).filter(row=>row.team_id).map(row=>[String(row.team_id),String(row.status||"submitted")])));
    }).catch(()=>{});
    return ()=>{active=false;};
  },[isOwnProfile,playerId]);

  function chooseTeam(item:{id:string;name:string;country:string;league_name:string}) {
    setTeamId(item.id);
    setTeamName(item.name);
    setLeagueName(item.league_name);
    setCountry(item.country);
    if(item.id) setManualTeam(false);
  }

  async function matchExistingStop(stop:CareerStop,item:{id:string;name:string;country:string;league_name:string}) {
    if(!canManage || matching || !item.id) return;
    setMatching(true);setMessage("");
    try {
      const {data:{user}} = await supabase.auth.getUser();
      if(user?.id!==playerId) {setMessage("Sign in as the profile owner to match a team.");return;}
      const changes = {team_id:item.id,team_name:item.name,country:item.country||stop.country,league_name:item.league_name||stop.league_name};
      const {error} = await supabase.from("player_career_stops").update(changes).eq("id",stop.id).eq("player_id",playerId);
      if(error) {setMessage("Team match could not be saved. Try again.");return;}
      setStops(current=>current.map(row=>row.id===stop.id?{...row,...changes}:row));
      setMatchingStop(null);
      setMessage("Team linked to your career stop. Review eligibility is still checked separately.");
    } finally {setMatching(false);}
  }

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
      setManualTeam(false);setEditingStop(false);
      setMessage("Career stop saved privately. You can review this team later after completing the review checklist.");await load();
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

  return <section id="career-passport" className="hc-journey-section">
    <div className="hc-journey-heading"><div><p className="eyebrow">CAREER PASSPORT</p><h2>My Journey<span>.</span></h2><p>Every stop tells part of the story.</p></div><span className="hc-journey-stamp">PLAYER<br/>HISTORY</span></div>
    {loading ? <p className="muted">Loading career stops…</p> : stamps.length > 0 && <div className="hc-passport-countries" aria-label="Countries played">
      <div className="hc-passport-countries__top"><strong>Countries played</strong><span>{stamps.length} {stamps.length === 1 ? "country" : "countries"}</span></div>
      <ul className="hc-passport-stamp-grid" aria-label="Career country stamps">
        {stamps.map((stamp,index) => <li className="hc-passport-country-stamp" key={stamp.country.toLocaleLowerCase("en")}
          style={{"--hc-stamp-tilt":index % 2 ? "1deg" : "-1deg"} as CSSProperties}>
          <span className="hc-passport-country-stamp__top"><span aria-hidden="true">{FLAGS[stamp.country] || "🌍"}</span>
            <span>HOOPCHECK · CAREER</span></span>
          <strong className="hc-passport-country-stamp__country">{stamp.country}</strong>
          <span className="hc-passport-country-stamp__clubs">{stamp.teams.slice(0,2).join(" · ")}{stamp.teams.length > 2 ? ` +${stamp.teams.length - 2} teams` : ""}</span>
          <span className="hc-passport-country-stamp__bottom"><span>{stamp.seasons.slice(0,2).join(" / ") || "Season not listed"}</span>
            {isOwnProfile && stamp.privateCount > 0 && <em>Includes private</em>}</span>
        </li>)}
      </ul>
      <p className="hc-passport-countries__note">Career entries are player-reported, not independently verified.{isOwnProfile ? " Private entries are visible only to you." : ""}</p>
    </div>}
    {!loading && visibleStops.length > 0 ? <div className="hc-journey-timeline">
      {visibleStops.map((stop,index) => <article className="hc-journey-stop" key={stop.id}>
        <div className="hc-journey-stop__rail"><span className="hc-journey-stop__dot">{String(index+1).padStart(2,"0")}</span>{index<visibleStops.length-1&&<span className="hc-journey-stop__line"/>}</div>
        <div className="hc-journey-stop__card">
          <div className="hc-journey-stop__top"><span className="hc-journey-stop__flag" aria-label={stop.country}>{FLAGS[stop.country]||"🌍"}</span><span className="hc-journey-stop__season">{stop.seasons}</span>{stop.is_public&&<span className="hc-journey-public">PUBLIC</span>}</div>
          <div className="hc-journey-stop__team"><span className="hc-journey-stop__crest">{monogram(stop.team_name)}</span><div><h3>{stop.team_name}</h3><p>{stop.league_name||"League not listed"} · {stop.country}</p>{stop.position&&<small>Position · {stop.position}</small>}</div></div>
          <div className="hc-journey-stop__footer">
            {stop.team_id ? <Link href={`/teams/${encodeURIComponent(stop.team_id)}`}>Team profile</Link> : <span className="muted">Unlisted team</span>}
            {isOwnProfile&&<div>{stop.team_id ? reviewedTeams[stop.team_id] ? <span className="hc-journey-review-status">Review {reviewedTeams[stop.team_id] === "approved" ? "published" : reviewedTeams[stop.team_id] === "pending" ? "pending" : "submitted"}</span> : <Link className="hc-journey-review-link" href={`/account?reviewTeam=${encodeURIComponent(stop.team_id)}#team-review-checklist`}>Review when ready →</Link> : canManage&&<button type="button" onClick={()=>setMatchingStop(current=>current===stop.id?null:stop.id)} aria-expanded={matchingStop===stop.id}>Match team</button>}{canManage&&<><button type="button" onClick={()=>void toggleVisibility(stop)}>{stop.is_public?"Make private":"Make public"}</button><button type="button" onClick={()=>void removeStop(stop)}>Remove</button></>}</div>}
          </div>
          {isOwnProfile&&canManage&&matchingStop===stop.id&&<div className="hc-journey-match-panel">
            <p>Find the same club in HoopCheck to connect this existing career stop to its review page.</p>
            <TeamLeaguePicker mode="team" directorySource="teams" includeAllTeams basketballType="mens" placeholder="Search name, league or country" onSelectItem={item=>{void matchExistingStop(stop,item);}} disabled={matching} />
            <button type="button" onClick={()=>setMatchingStop(null)} disabled={matching}>Cancel</button>
          </div>}
        </div>
      </article>)}
    </div> : !loading && <div className="hc-journey-empty"><span>01 / CAREER PASSPORT</span><h3>No career stops added yet</h3><p>Build a timeline of the teams, leagues, countries, seasons, and positions that shaped your career.</p></div>}
    {isOwnProfile && canManage && !loading && <PlayerPassportExport playerName={playerName} verifiedPlayer={verifiedPlayer} stops={stops} />}
    {isOwnProfile&&!canManage&&<div className="hc-journey-upgrade"><strong>Premium Players · My Journey</strong><p>Add career stops and create your professional basketball passport. Public sharing is always optional.</p><Link href="/membership" className="btn">Unlock My Journey</Link></div>}
    {isOwnProfile&&canManage&&<div className="hc-journey-editor">
      <div className="hc-journey-editor__intro">
        <div><strong>Career history & team reviews</strong><p>Find your club, save the season, and review it separately when you're ready. Adding a career stop does not publish a review or verify team affiliation.</p></div>
        <button type="button" className="btn hc-journey-add" aria-expanded={editingStop} aria-controls="career-stop-form" onClick={()=>{setEditingStop(value=>!value);setMessage("");}}>{editingStop?"Close form":"+ Add a career stop"}</button>
      </div>
      {message&&<p role="status" className="hc-journey-feedback">{message}</p>}
      {editingStop&&<form id="career-stop-form" className="hc-journey-form hc-liquid-glass-journey-form" onSubmit={addStop}>
        <p className="eyebrow">STEP 1 · FIND YOUR TEAM</p>
        {!manualTeam ? <>
          <TeamLeaguePicker mode="team" directorySource="teams" includeAllTeams basketballType="mens" label="Search the HoopCheck team directory" placeholder="Search team, country or league" value={teamId} onChange={value=>{if(!value)chooseTeam({id:"",name:"",country:"",league_name:""});}} onSelectItem={chooseTeam} />
          {teamId&&<p className="hc-journey-selected-team"><strong>{teamName}</strong><span>{[leagueName,country].filter(Boolean).join(" · ") || "Team selected"}</span></p>}
          <button type="button" className="hc-journey-manual-link" onClick={()=>{setManualTeam(true);chooseTeam({id:"",name:"",country:"",league_name:""});}}>Can't find your team? Enter it manually</button>
        </> : <>
          <button type="button" className="hc-journey-manual-link" onClick={()=>{setManualTeam(false);chooseTeam({id:"",name:"",country:"",league_name:""});}}>← Back to team search</button>
          <label>Team name <input value={teamName} onChange={event=>setTeamName(event.target.value)} maxLength={160} required placeholder="Team or club name"/></label>
          <label>League <input value={leagueName} onChange={event=>setLeagueName(event.target.value)} maxLength={160} placeholder="League name"/></label>
          <label>Country <input value={country} onChange={event=>setCountry(event.target.value)} maxLength={100} required placeholder="Country"/></label>
        </>}
        {!manualTeam&&teamId&&(!country||!leagueName) && <div className="hc-journey-form__row">
          {!country&&<label>Country <input value={country} onChange={event=>setCountry(event.target.value)} maxLength={100} required placeholder="Country"/></label>}
          {!leagueName&&<label>League (optional) <input value={leagueName} onChange={event=>setLeagueName(event.target.value)} maxLength={160} placeholder="League name"/></label>}
        </div>}
        {(!manualTeam||!!teamName)&&<div className="hc-journey-season-fields">
          <p className="eyebrow">STEP 2 · YOUR SEASON</p>
          <div className="hc-journey-form__row">
            <label>Season <input value={seasons} onChange={event=>setSeasons(event.target.value)} maxLength={80} required placeholder="2024–25"/></label>
            <label>Position (optional) <input value={position} onChange={event=>setPosition(event.target.value)} maxLength={60} placeholder="Guard, forward…"/></label>
          </div>
          <label className="hc-journey-public-toggle"><input type="checkbox" checked={isPublic} onChange={event=>setIsPublic(event.target.checked)}/><span><strong>Show this stop publicly</strong><small>Off by default. Career entries are player-reported, not verified reviews.</small></span></label>
          <button type="submit" className="btn hc-journey-save" disabled={saving||(!manualTeam&&!teamId)}>{saving?"Saving…":"Save career stop"}</button>
        </div>}
      </form>}
      <p className="hc-journey-review-hint">Reviews are optional and separate. A verified player, eligible playing history, and an active review-writing membership are required.</p>
    </div>}

  </section>;
}
