"use client";

import HoopLoading from "../../components/HoopLoading";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {supabase} from "../../lib/supabase";
import TeamLeaguePicker from "../../components/TeamLeaguePicker";
import { readOwnProfile } from "../../lib/read-own-profile";
import { isOnboardingRole, safeOnboardingReturn, type OnboardingRole } from "../../lib/onboarding-boundary";

type AccountType=OnboardingRole;

export default function OnboardingPage(){
 const router=useRouter();
 const [accountType,setAccountType]=useState<AccountType>("player");
 const [displayName,setDisplayName]=useState(""); const [bio,setBio]=useState("");
 const [position,setPosition]=useState("PG"); const [yearsPro,setYearsPro]=useState("0");
 const [country,setCountry]=useState(""); const [favoriteTeamName,setFavoriteTeamName]=useState("");
 const [basketballType,setBasketballType]=useState<"mens"|"womens">("mens");
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [message,setMessage]=useState(""); const [returnTo,setReturnTo]=useState("");
 const [owner,setOwner]=useState<string|null>(null); const [loadFailed,setLoadFailed]=useState(false);

 useEffect(()=>{
  let active=true;
  setReturnTo(safeOnboardingReturn(new URLSearchParams(window.location.search).get("returnTo"),window.location.origin));
  void (async()=>{try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(!active)return;
   if(authError)throw authError;
   if(!user){router.replace("/login");return;}
   const {data:p,error}=await readOwnProfile<{id:string;account_type:unknown;display_name:string|null;bio:string|null;position:string|null;years_pro:number|null;country:string|null;basketball_type:string|null;favorite_teams:string|null}>(user.id,"id,display_name,account_type,bio,position,years_pro,country,basketball_type,favorite_teams");
   if(!active)return;
   if(error||!p||p.id!==user.id||!isOnboardingRole(p.account_type))throw new Error("Profile unavailable");
   setOwner(user.id); setAccountType(p.account_type);
   setDisplayName(p.display_name||""); setBio(p.bio||"");
   setPosition(p.position||"PG"); setYearsPro(String(p.years_pro??0)); setCountry(p.country||""); setBasketballType(p.basketball_type==="womens"?"womens":"mens");
   setFavoriteTeamName(String(p.favorite_teams||"").split(",")[0].trim());
  }catch{if(active)setLoadFailed(true);}finally{if(active)setLoading(false);}})();
  return()=>{active=false;};
 },[router]);

 async function save(){
  if(saving||!owner||loadFailed)return;
  setSaving(true);setMessage("");
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user||user.id!==owner)throw new Error("Account changed");
   const {data:sessionData,error:sessionError}=await supabase.auth.getSession();
   const session=sessionData.session;
   if(sessionError||session?.user.id!==owner||!session.access_token)throw new Error("Account changed");
   const token=session.access_token;
   const {data:profile,error:profileError}=await readOwnProfile<{id:string;account_type:unknown}>(owner,"id,account_type");
   if(profileError||!profile||profile.id!==owner||profile.account_type!==accountType)throw new Error("Role changed");
   const current=await supabase.auth.getSession();
   if(current.error||current.data.session?.user.id!==owner||current.data.session.access_token!==token)throw new Error("Session changed");
   const updates:Record<string,string|number|null>={display_name:displayName.trim().slice(0,80)||null,bio:bio.trim().slice(0,500)||null,favorite_teams:favoriteTeamName};
   if(accountType==="player"||accountType==="fan")updates.basketball_type=basketballType;
   if(accountType==="player"){updates.position=position;updates.years_pro=Number(yearsPro);updates.country=country||null;}
   const {data,error}=await supabase.from("profiles").update(updates).eq("id",owner).setHeader("Authorization",`Bearer ${token}`).select("id").maybeSingle();
   if(error||data?.id!==owner)throw new Error("Save not confirmed");
   const after=await supabase.auth.getSession();
   if(after.error||after.data.session?.user.id!==owner||after.data.session.access_token!==token)throw new Error("Session changed");
   router.replace(returnTo||"/dashboard");
  }catch{setMessage("Your profile could not be saved. Check your connection or sign in again and retry.");}
  finally{setSaving(false);}
 }

 if(loading)return <main className="page-shell"><HoopLoading label="Loading HoopCheck…" /></main>;
 if(loadFailed||!owner)return <main className="page-shell"><div className="page-container"><section className="hero-card"><h1>Profile setup unavailable</h1><p role="alert">Your account profile could not be verified. Sign in again or contact support.</p><div className="actions"><Link className="btn" href="/login">Sign in</Link><Link className="btn dark" href="/support">Contact support</Link></div></section></div></main>;
 const label={player:"Player",coach:"Coach",scout:"Scout",agent:"Agent",fan:"Fan",manager:"Team Manager"}[accountType];
 const nonPlayer=accountType!=="player";
 return <main className="page-shell hc-onboarding-page"><div className="page-container signup-complete-shell">
  <nav aria-label="Profile setup links" className="actions"><Link href="/support" className="btn dark">Help</Link><Link href="/login" className="btn dark">Sign in</Link></nav>
  <section className="hero-card"><p className="eyebrow">PROFILE SETUP · {label.toUpperCase()}</p><h1>Make HoopCheck yours.</h1><p className="muted">{nonPlayer?"A research-first profile with no player-only questions.":"A professional-player profile with structured basketball information."}</p></section>
  <section className="dashboard-card" style={{marginTop:18,display:"grid",gap:12}}>
   <label>Display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={80}/></label>
   {accountType==="player"&&<><div className="signup-two-col"><label>Position<select value={position} onChange={e=>setPosition(e.target.value)}><option>PG</option><option>SG</option><option>SF</option><option>PF</option><option>C</option></select></label><label>Years pro<select value={yearsPro} onChange={e=>setYearsPro(e.target.value)}>{Array.from({length:26},(_,i)=><option key={i} value={i}>{i}</option>)}</select></label></div>
   <label>Home country<select value={country} onChange={e=>setCountry(e.target.value)}><option value="">Select country</option>
   <optgroup label="Africa">{["Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cameroon","Cape Verde","Central African Republic","Chad","Comoros","Côte d’Ivoire","Democratic Republic of the Congo","Djibouti","Egypt","Equatorial Guinea","Eritrea","Eswatini","Ethiopia","Gabon","Gambia","Ghana","Guinea","Guinea-Bissau","Kenya","Lesotho","Liberia","Libya","Madagascar","Malawi","Mali","Mauritania","Mauritius","Morocco","Mozambique","Namibia","Niger","Nigeria","Republic of the Congo","Rwanda","Senegal","Seychelles","Sierra Leone","Somalia","South Africa","South Sudan","Sudan","Tanzania","Togo","Tunisia","Uganda","Zambia","Zimbabwe"].map(x=><option key={x}>{x}</option>)}</optgroup>
   <optgroup label="Asia">{["Afghanistan","Armenia","Azerbaijan","Bahrain","Bangladesh","Bhutan","Brunei","Cambodia","China","Chinese Taipei","Cyprus","Georgia","Hong Kong","India","Indonesia","Iran","Iraq","Israel","Japan","Jordan","Kazakhstan","Kuwait","Kyrgyzstan","Laos","Lebanon","Malaysia","Maldives","Mongolia","Myanmar","Nepal","North Korea","Oman","Pakistan","Palestine","Philippines","Qatar","Saudi Arabia","Singapore","South Korea","Sri Lanka","Syria","Tajikistan","Thailand","Timor-Leste","Turkmenistan","United Arab Emirates","Uzbekistan","Vietnam","Yemen"].map(x=><option key={x}>{x}</option>)}</optgroup>
   <optgroup label="Europe">{["Albania","Andorra","Austria","Belarus","Belgium","Bosnia and Herzegovina","Bulgaria","Croatia","Czechia","Denmark","Estonia","Finland","France","Germany","Greece","Hungary","Iceland","Ireland","Italy","Kosovo","Latvia","Liechtenstein","Lithuania","Luxembourg","Malta","Moldova","Monaco","Montenegro","Netherlands","North Macedonia","Norway","Poland","Portugal","Romania","Russia","San Marino","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Türkiye","Ukraine","United Kingdom","Vatican City"].map(x=><option key={x}>{x}</option>)}</optgroup>
   <optgroup label="North America">{["Antigua and Barbuda","Bahamas","Barbados","Belize","Canada","Costa Rica","Cuba","Dominica","Dominican Republic","El Salvador","Grenada","Guatemala","Haiti","Honduras","Jamaica","Mexico","Nicaragua","Panama","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Trinidad and Tobago","United States"].map(x=><option key={x}>{x}</option>)}</optgroup>
   <optgroup label="South America">{["Argentina","Bolivia","Brazil","Chile","Colombia","Ecuador","Guyana","Paraguay","Peru","Suriname","Uruguay","Venezuela"].map(x=><option key={x}>{x}</option>)}</optgroup>
   <optgroup label="Oceania">{["Australia","Fiji","Kiribati","Marshall Islands","Micronesia","Nauru","New Zealand","Palau","Papua New Guinea","Samoa","Solomon Islands","Tonga","Tuvalu","Vanuatu"].map(x=><option key={x}>{x}</option>)}</optgroup>
   </select></label></>}
   <TeamLeaguePicker mode="team" label="Team to follow" value={favoriteTeamName} returnValue="name" onChange={setFavoriteTeamName} basketballType={basketballType} placeholder="Search teams by name, city or country" />
   {accountType==="player"&&<div><label>Basketball</label><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}><button type="button" className={basketballType==="mens"?"btn":"btn dark"} onClick={()=>{setBasketballType("mens");setFavoriteTeamName("");}}>Men’s</button><button type="button" className={basketballType==="womens"?"btn":"btn dark"} onClick={()=>{setBasketballType("womens");setFavoriteTeamName("");}}>Women’s</button></div></div>}
   <label>Bio<textarea value={bio} onChange={e=>setBio(e.target.value)} rows={5} maxLength={500} placeholder="Tell the basketball community about yourself." /></label>
   {message&&<p className="muted" role="alert">{message}</p>}
   <button className="btn" onClick={save} disabled={saving}>{saving?"Saving...":"Save & Go to Dashboard"}</button>
  </section>
 </div></main>;
}
