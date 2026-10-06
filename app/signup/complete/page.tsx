"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type AccountType = "player"|"coach"|"fan"|"scout"|"agent";
type Team = {id:string;name:string;country:string|null;league_name?:string|null};

function Complete(){
  const params=useSearchParams(); const email=params.get("email");
  const [accountType,setAccountType]=useState<AccountType>("player");
  const [basketballType,setBasketballType]=useState<"mens"|"womens">("mens");
  const [favoriteTeamId,setFavoriteTeamId]=useState(""); const [teams,setTeams]=useState<Team[]>([]);
  const [teamCountry,setTeamCountry]=useState(""); const [teamLeague,setTeamLeague]=useState("");
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    async function load(){
      const {data:{user}}=await supabase.auth.getUser();
      const metadata=(user?.user_metadata?.account_type||"player") as AccountType;
      setAccountType(metadata);
      const {data}=await supabase.from("teams").select("id,name,country,league_name").eq("active",true).order("name").limit(1000);
      setTeams((data||[]) as Team[]);
    }
    void load();
  },[]);

  async function continueProfile(){
    const favoriteName=teams.find(t=>t.id===favoriteTeamId)?.name||"";
    localStorage.setItem("hoopcheck_profile_setup",JSON.stringify({accountType,basketballType,favoriteTeamId}));
    const {data:{user}}=await supabase.auth.getUser();
    if(user) await supabase.from("profiles").update({account_type:accountType,basketball_type:basketballType,favorite_teams:favoriteName}).eq("id",user.id);
    setSaved(true);
  }

  const label={player:"Player",coach:"Coach",fan:"Fan",scout:"Scout",agent:"Agent"}[accountType];
  const teamCountries=Array.from(new Set(teams.map(t=>t.country).filter(Boolean) as string[])).sort();
  const teamLeagues=Array.from(new Set(teams.filter(t=>!teamCountry||t.country===teamCountry).map(t=>(t as any).league_name).filter(Boolean) as string[])).sort();
  const filteredTeams=teams.filter(t=>(!teamCountry||t.country===teamCountry)&&(!teamLeague||(t as any).league_name===teamLeague));
  const nonPlayer=accountType!=="player";

  return <main className="page-shell"><div className="page-container signup-complete-shell">
    <section className="hero-card"><p className="eyebrow">WELCOME TO HOOPCHECK</p><h1>Let’s personalize your experience.</h1><p className="muted">Your account is created{email?" for "+email:""} as a <strong>{label}</strong>. We’ll keep setup focused on what matters for your role.</p></section>

    <section className="dashboard-card" style={{marginTop:18}}>
      <p className="eyebrow">01 · ACCOUNT TYPE</p><h2>{label} account</h2>
      <p className="muted">{nonPlayer?"Research-first setup. We won’t ask you for player position, years pro, or former teams.":"Professional-player setup with optional basketball preferences."}</p>
    </section>

    {accountType==="player"&&<section className="dashboard-card" style={{marginTop:18}}>
      <p className="eyebrow">02 · BASKETBALL</p><h2>Which game are you playing?</h2>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}><button type="button" className={basketballType==="mens"?"btn":"btn dark"} onClick={()=>setBasketballType("mens")}>Men’s Basketball</button><button type="button" className={basketballType==="womens"?"btn":"btn dark"} onClick={()=>setBasketballType("womens")}>Women’s Basketball</button></div>
    </section>}

    <section className="dashboard-card" style={{marginTop:18}}>
      <p className="eyebrow">{accountType==="player"?"03":"02"} · FOLLOW</p><h2>Choose a team to follow</h2>
      <p className="muted">Pick one now. You can follow more teams from team profiles later.</p>
      <div className="signup-two-col fan-team-filters" style={{marginTop:10}}><div><label htmlFor="setup-country">Country</label><select id="setup-country" value={teamCountry} onChange={e=>{setTeamCountry(e.target.value);setTeamLeague("");setFavoriteTeamId("");}}><option value="">All countries</option>{teamCountries.map(x=><option key={x} value={x}>{x}</option>)}</select></div><div><label htmlFor="setup-league">League</label><select id="setup-league" value={teamLeague} onChange={e=>{setTeamLeague(e.target.value);setFavoriteTeamId("");}}><option value="">All leagues</option>{teamLeagues.map(x=><option key={x} value={x}>{x}</option>)}</select></div></div><select value={favoriteTeamId} onChange={e=>setFavoriteTeamId(e.target.value)} style={{marginTop:10}}>
        <option value="">Select a team</option>
        {filteredTeams.map(t=><option key={t.id} value={t.id}>{t.name}{t.country?" — "+t.country:""}{t.league_name?" · "+t.league_name:""}</option>)}
      </select>
    </section>

    <section className="dashboard-card" style={{marginTop:18}}>
      <p className="eyebrow">{accountType==="player"?"04":"03"} · NEXT STEP</p><h2>Finish your profile</h2>
      <p className="muted">{accountType==="player"?"Players can complete professional verification and locked identity fields from Profile.":"Customize your research preferences from Profile. You can follow teams, players, and leagues as you explore HoopCheck."}</p>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:16}}><button className="btn" onClick={continueProfile}>Save & Continue</button><Link href="/login" className="btn dark">Sign In Later</Link></div>
      {saved&&<p className="muted" style={{marginTop:12}}>Saved. Your HoopCheck profile is ready.</p>}
    </section>
  </div></main>;
}
export default function SignupCompletePage(){return <Suspense fallback={<main className="page-shell"><div className="page-container">Loading...</div></main>}><Complete/></Suspense>}
