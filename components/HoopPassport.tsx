"use client";
import {useState} from "react";
import Link from "next/link";
type Props={name:string;accountType:string;username?:string|null;verified?:boolean;country?:string|null;position?:string|null;team?:string|null;};
export default function HoopPassport({name,accountType,username,verified=false,country,position,team}:Props){
 const [showDetails,setShowDetails]=useState(false);
 const role=accountType==="fan"?"FAN":accountType==="player"?"PLAYER":accountType.toUpperCase();
 const detail=[position,team,country].filter(Boolean).join(" · ");
 return <section className="hc-smooth-passport hc-liquid-glass-passport" aria-label="Your HoopCheck identity card"><div className="hc-smooth-passport__top"><span>HOOP<span className="hc-smooth-passport__orange">CHECK</span></span><span>IDENTITY PASS</span></div><div className="hc-smooth-passport__body"><div className="hc-smooth-passport__hex" aria-hidden="true">{name.trim().charAt(0).toUpperCase()||"H"}</div><div className="hc-smooth-passport__identity"><small>{role} · {verified?"VERIFIED":"MEMBER"}</small><strong>{name}</strong>{username&&<span>@{username}</span>}{detail&&<span>{detail}</span>}</div></div><div className="hc-smooth-passport__bottom"><button type="button" aria-expanded={showDetails} onClick={()=>setShowDetails(v=>!v)}>{showDetails?"Hide details":"About this pass"}</button><Link href="/account">Edit profile →</Link></div>{showDetails&&<p className="hc-smooth-passport__notice">This card reflects your HoopCheck account profile. It is not an identity document, a membership receipt, or independent verification of playing history.</p>}</section>;
}
