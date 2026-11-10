"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../../lib/supabase";
type Dispute={id:string;entry_id:string;team_id:string;reason:string;created_at:string;status:string};
export default function RosterModerationPage(){
 const [items,setItems]=useState<Dispute[]>([]);const [loading,setLoading]=useState(true);const [allowed,setAllowed]=useState(false);const [busy,setBusy]=useState("");const [message,setMessage]=useState("");
 async function refresh(){const {data,error}=await supabase.from("club_roster_disputes").select("id,entry_id,team_id,reason,created_at,status").eq("status","pending").order("created_at",{ascending:true});if(error)setMessage(error.message);else setItems((data||[]) as Dispute[]);}
 useEffect(()=>{let active=true;void (async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){if(active)setLoading(false);return;}const {data:profile}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();if(!active)return;if(!profile||!["admin","moderator"].includes(profile.account_type)){setLoading(false);return;}setAllowed(true);await refresh();if(active)setLoading(false)})();return()=>{active=false}},[]);
 async function resolve(id:string,resolution:"resolved"|"rejected"){if(busy)return;setBusy(id);setMessage("");const {error}=await supabase.rpc("resolve_club_roster_dispute",{p_dispute_id:id,p_resolution:resolution});if(error)setMessage(error.message);else{setMessage("Dispute "+resolution+".");await refresh()}setBusy("");}
 if(loading)return <main className="page-shell"><div className="page-container">Loading roster moderation…</div></main>;
 if(!allowed)return <main className="page-shell"><div className="page-container"><h1>Restricted</h1><p>HoopCheck moderators only.</p><Link href="/dashboard">Dashboard</Link></div></main>;
 return <main className="page-shell"><div className="page-container"><header className="hero-card"><p className="eyebrow">HOOPCHECK MODERATION</p><h1>Roster disputes</h1><p className="muted">Review linked-player roster disputes. Resolution clears the pending label; verify evidence before deciding.</p></header>
 {message&&<p role="status">{message}</p>}
 {items.map(d=><article key={d.id} className="dashboard-card" style={{marginTop:12}}><p className="eyebrow">PENDING DISPUTE</p><p>{d.reason}</p><small className="muted">Club {d.team_id} · Entry {d.entry_id} · {new Date(d.created_at).toLocaleString()}</small><div style={{display:"flex",gap:8,marginTop:12}}><button type="button" className="btn" disabled={!!busy} onClick={()=>void resolve(d.id,"resolved")}>Resolve</button><button type="button" className="btn dark" disabled={!!busy} onClick={()=>void resolve(d.id,"rejected")}>Reject</button></div></article>)}
 {!items.length&&<p className="muted">No pending roster disputes.</p>}</div></main>;
}
