"use client";
import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
import {countryFlag} from "../lib/countryFlag";
import Link from "next/link";
type Props={name:string;accountType:string;username?:string|null;verified?:boolean;country?:string|null;position?:string|null;team?:string|null;playerId?:string|null;};
export default function HoopPassport({name,accountType,username,verified=false,country,position,team,playerId}:Props){
 const [showDetails,setShowDetails]=useState(false);
 const [playedCountries,setPlayedCountries]=useState<string[]>([]);
 useEffect(()=>{
  if(accountType!=="player"||!playerId){setPlayedCountries([]);return;}
  let active=true;
  void supabase.from("player_career_stops").select("country").eq("player_id",playerId).then(({data,error})=>{
   if(!active)return;
   setPlayedCountries(error?[]:Array.from(new Set((data||[]).map(stop=>String(stop.country||"").trim()).filter(Boolean))).sort());
  });
  return()=>{active=false;};
 },[accountType,playerId]);
 const role=accountType==="fan"?"FAN":accountType==="player"?"PLAYER":accountType.toUpperCase();
 const detail=[position,team,country].filter(Boolean).join(" · ");
 return <section className="hc-smooth-passport" aria-label="Your HoopCheck identity card"><div className="hc-smooth-passport__top"><span>HOOP<span className="hc-smooth-passport__orange">CHECK</span></span><span>IDENTITY PASS</span></div><div className="hc-smooth-passport__body"><div className="hc-smooth-passport__hex" aria-hidden="true">{name.trim().charAt(0).toUpperCase()||"H"}</div><div className="hc-smooth-passport__identity"><small>{role} · {verified?"VERIFIED":"MEMBER"}</small><strong>{name}</strong>{username&&<span>@{username}</span>}{detail&&<span>{detail}</span>}{accountType==="player"&&playedCountries.length>0&&<span aria-label="Countries played in">Played in {playedCountries.map(name=>`${countryFlag(name)||"🌍"} ${name}`).join(" · ")}</span>}</div></div><div className="hc-smooth-passport__bottom"><button type="button" aria-expanded={showDetails} onClick={()=>setShowDetails(v=>!v)}>{showDetails?"Hide details":"About this pass"}</button><Link href="/account">Edit profile →</Link></div>{showDetails&&<p className="hc-smooth-passport__notice">This card reflects your HoopCheck account profile. It is not an identity document, a membership receipt, or independent verification of playing history.</p>}</section>;
}
