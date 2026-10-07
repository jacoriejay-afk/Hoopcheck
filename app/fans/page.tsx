"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../lib/supabase";
import FanConnectionButton from "../../components/FanConnectionButton";
import HoopLoading from "../../components/HoopLoading";

type Fan={id:string;display_name:string|null;username:string|null;avatar_url:string|null;bio:string|null};

export default function FansPage(){
  const [fans,setFans]=useState<Fan[]>([]); const [loading,setLoading]=useState(true); const [q,setQ]=useState("");
  useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){location.href="/login";return;}const {data}=await supabase.from("profiles").select("id,display_name,username,avatar_url,bio").eq("account_type","fan").neq("id",user.id).order("display_name").limit(100);setFans((data||[]) as Fan[]);setLoading(false);})();},[]);
  if(loading)return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading fans..." /></div></main>;
  const filtered=fans.filter(f=>(f.display_name||f.username||"").toLowerCase().includes(q.toLowerCase()));
  return <main className="page-shell"><div className="page-container">
    <header className="topbar"><Link href="/" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/dashboard">Back</Link><Link href="/teams">Teams</Link><Link href="/account">Profile</Link></nav></header>
    <section className="hero-card"><p className="eyebrow">FAN NETWORK</p><h1>Find Fans</h1><p className="muted">Pro and Premium Fans can send connection requests to other fans.</p><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search fans..." /></section>
    <section className="grid" style={{marginTop:14}}>{filtered.map(f=><article className="dashboard-card" key={f.id}><div style={{display:"flex",gap:12,alignItems:"center"}}>{f.avatar_url?<img src={f.avatar_url} alt="" style={{width:46,height:46,borderRadius:"50%",objectFit:"cover"}}/>:<div className="player-avatar-fallback">HC</div>}<div><h2 style={{margin:0}}>{f.display_name||f.username||"HoopCheck Fan"}</h2><p className="muted" style={{margin:"4px 0 0"}}>@{f.username||"fan"}</p></div></div>{f.bio&&<p className="muted">{f.bio}</p>}<div style={{marginTop:12}}><FanConnectionButton fanId={f.id}/></div><Link href={"/fans/"+f.id} className="btn dark" style={{marginTop:10}}>View Fan Profile</Link></article>)}</section>
    {!filtered.length&&<div className="dashboard-card" style={{marginTop:14}}><h2>No fans found.</h2></div>}
    <div className="bottom-back"><button type="button" className="btn dark" onClick={()=>window.history.back()}>← Back</button></div>
  </div></main>;
}
