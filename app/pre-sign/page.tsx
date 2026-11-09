"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
const checks=[
 {id:"identity",title:"Verify the club",detail:"Confirm the club, competition, country, and the person offering the contract.",href:"/teams",link:"Browse clubs"},
 {id:"reviews",title:"Read player experiences",detail:"Look for multiple published reviews and compare the details—not just the overall score.",href:"/reviews",link:"Explore reviews"},
 {id:"pay",title:"Ask about payment reliability",detail:"Check what players report about payment timing. Missing or low-sample data is not proof of reliability.",href:"/teams",link:"Research clubs"},
 {id:"roster",title:"Check roster movement",detail:"Look for confirmed arrivals and departures; distinguish club-listed updates from independent sources.",href:"/teams",link:"Explore team profiles"},
 {id:"contract",title:"Verify the offer in writing",detail:"Confirm salary, currency, dates, housing, travel, medical coverage, termination terms and dispute process.",href:"/directory",link:"Research the directory"},
 {id:"references",title:"Speak with former players",detail:"Independently verify at least two references and ask specific questions about daily operations.",href:"/players",link:"Find players"}
] as const;
export default function PreSignPage(){
 const [done,setDone]=useState<string[]>([]);
 const [ready,setReady]=useState(false);
 useEffect(()=>{try{const saved=window.localStorage.getItem("hc-presign-checks-v1");if(saved){const parsed:unknown=JSON.parse(saved);if(Array.isArray(parsed))setDone(parsed.filter((id):id is string=>typeof id==="string"&&checks.some(c=>c.id===id)));}}catch{}setReady(true);},[]);
 useEffect(()=>{if(!ready)return;try{window.localStorage.setItem("hc-presign-checks-v1",JSON.stringify(done));}catch{}},[done,ready]);
 const progress=Math.round(done.length/checks.length*100);
 return <main className="hc-smooth-presign"><div className="page-container">
  <header className="hc-smooth-presign-hero hc-smooth-reveal"><p className="eyebrow">HOOPCHECK · PLAYER INTELLIGENCE</p><h1>PRE-SIGN CHECK<span>.</span></h1><p>One decision. Six checks. Research the club before you commit.</p><div className="hc-smooth-presign-meter" role="progressbar" aria-label="Pre-sign checklist progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:progress+"%"}}/></div><small>{done.length} of {checks.length} checks reviewed · {progress}%</small></header>
  <div className="hc-smooth-presign-list">{checks.map((item,index)=><article className="hc-smooth-presign-item hc-smooth-card" key={item.id}><div className="hc-smooth-presign-number">{String(index+1).padStart(2,"0")}</div><div><h2>{item.title}</h2><p>{item.detail}</p><Link href={item.href}>{item.link} →</Link></div><label className="hc-smooth-presign-check"><input type="checkbox" checked={done.includes(item.id)} onChange={e=>setDone(old=>e.target.checked?[...old,item.id]:old.filter(x=>x!==item.id))}/><span>Reviewed</span></label></article>)}</div>
  <p className="hc-smooth-presign-note">This is a personal research checklist, not a verification badge or legal advice. Your selections stay in this browser and are not shared with HoopCheck. A completed checklist does not guarantee a safe contract.</p>
  <button type="button" className="hc-smooth-presign-reset" onClick={()=>setDone([])} disabled={!done.length}>Reset checklist</button>
 </div></main>;
}
