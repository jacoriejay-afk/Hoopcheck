"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {supabase} from "../../lib/supabase";

type AccountType="player"|"coach"|"scout"|"agent"|"fan";
type Team={id:string;name:string;country:string|null;league_name:string|null};

export default function OnboardingPage(){
 const router=useRouter();
 const [accountType,setAccountType]=useState<AccountType>("player");
 const [displayName,setDisplayName]=useState(""); const [bio,setBio]=useState("");
 const [position,setPosition]=useState("PG"); const [yearsPro,setYearsPro]=useState("0");
 const [country,setCountry]=useState(""); const [favoriteTeamId,setFavoriteTeamId]=useState("");
 const [basketballType,setBasketballType]=useState<"mens"|"womens">("mens");
 const [teams,setTeams]=useState<Team[]>([]); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [message,setMessage]=useState("");

 useEffect(()=>{(async()=>{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.user){router.replace("/login");return;}
  const {data:p}=await supabase.from("profiles").select("display_name,account_type,bio,position,years_pro,country,basketball_type,favorite_teams").eq("id",session.user.id).maybeSingle();
  setAccountType((p?.account_type||session.user.user_metadata?.account_type||"player") as AccountType);
  setDisplayName(p?.display_name||session.user.user_metadata?.full_name||""); setBio(p?.bio||"");
  setPosition(p?.position||"PG"); setYearsPro(String(p?.years_pro??0)); setCountry(p?.country||""); setBasketballType(p?.basketball_type||"mens");
  const {data:t}=await supabase.from("teams").select("id,name,country,league_name").eq("active",true).order("name").limit(1000); setTeams(t||[]);
  if(p?.favorite_teams){const first=String(p.favorite_teams).split(",")[0].trim();const found=(t||[]).find(x=>x.name===first);if(found)setFavoriteTeamId(found.id);}
  setLoading(false);
 })()},[router]);

 async function save(){
  setSaving(true);setMessage("");
  const {data:{user}}=await supabase.auth.getUser(); if(!user){router.replace("/login");return;}
  const favorite=teams.find(t=>t.id===favoriteTeamId)?.name||"";
  const updates:any={display_name:displayName.trim().slice(0,80)||null,bio:bio.trim().slice(0,500)||null,favorite_teams:favorite,basketball_type:basketballType};
  if(accountType==="player"){updates.position=position;updates.years_pro=Number(yearsPro);updates.country=country||null;}
  const {error}=await supabase.from("profiles").update(updates).eq("id",user.id);
  if(error)setMessage(error.message);else{setMessage("Profile setup saved.");setTimeout(()=>router.push("/dashboard"),500);}
  setSaving(false);
 }

 if(loading)return <main className="page-shell"><div className="page-container"><p>Loading profile setup...</p></div></main>;
 const label={player:"Player",coach:"Coach",scout:"Scout",agent:"Agent",fan:"Fan"}[accountType];
 const nonPlayer=accountType!=="player";
 return <main className="page-shell"><div className="page-container signup-complete-shell">
  <header className="topbar"><Link href="/" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/support">Help</Link><Link href="/login">Sign in</Link></nav></header>
  <section className="hero-card"><p className="eyebrow">PROFILE SETUP · {label.toUpperCase()}</p><h1>Make HoopCheck yours.</h1><p className="muted">{nonPlayer?"A research-first profile with no player-only questions.":"A professional-player profile with structured basketball information."}</p></section>
  <section className="dashboard-card" style={{marginTop:18,display:"grid",gap:12}}>
   <label>Display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={80}/></label>
   {accountType==="player"&&<><div className="signup-two-col"><label>Position<select value={position} onChange={e=>setPosition(e.target.value)}><option>PG</option><option>SG</option><option>SF</option><option>PF</option><option>C</option></select></label><label>Years pro<select value={yearsPro} onChange={e=>setYearsPro(e.target.value)}>{Array.from({length:26},(_,i)=><option key={i} value={i}>{i}</option>)}</select></label></div>
   <label>Home country<select value={country} onChange={e=>setCountry(e.target.value)}><option value="">Select country</option>{["United States","Azerbaijan","Austria","France","Germany","Greece","Italy","Portugal","Russia","Serbia","Spain","Türkiye","United Kingdom","Other"].map(x=><option key={x}>{x}</option>)}</select></label></>}
   <label>Team to follow<select value={favoriteTeamId} onChange={e=>setFavoriteTeamId(e.target.value)}><option value="">Select a team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}{t.country?" — "+t.country:""}{t.league_name?" · "+t.league_name:""}</option>)}</select></label>
   {accountType==="player"&&<div><label>Basketball</label><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}><button type="button" className={basketballType==="mens"?"btn":"btn dark"} onClick={()=>setBasketballType("mens")}>Men’s</button><button type="button" className={basketballType==="womens"?"btn":"btn dark"} onClick={()=>setBasketballType("womens")}>Women’s</button></div></div>}
   <label>Bio<textarea value={bio} onChange={e=>setBio(e.target.value)} rows={5} maxLength={500} placeholder="Tell the basketball community about yourself." /></label>
   {message&&<p className="muted">{message}</p>}
   <button className="btn" onClick={save} disabled={saving}>{saving?"Saving...":"Save & Go to Dashboard"}</button>
  </section>
 </div></main>;
}
