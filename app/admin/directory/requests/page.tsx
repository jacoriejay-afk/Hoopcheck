"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../../../lib/supabase";

type Row={id:string;team_name:string;country:string;city:string|null;league_name:string|null;status:string;created_at:string};

export default function DirectoryTeamRequests(){
 const [rows,setRows]=useState<Row[]>([]); const [message,setMessage]=useState("");
 async function load(){const {data}=await supabase.from("directory_team_requests").select("id,team_name,country,city,league_name,status,created_at").order("created_at",{ascending:false});setRows((data||[]) as Row[]);}
 useEffect(()=>{(async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session){location.href="/login";return;}const {data:ok}=await supabase.rpc("is_current_user_admin_or_moderator");if(!ok){location.href="/dashboard";return;}await load();})();},[]);
 async function review(id:string,status:"approved"|"rejected"){setMessage("");const {error}=await supabase.rpc("admin_review_directory_team_request",{p_request_id:id,p_status:status,p_note:null});if(error)setMessage(error.message);else{setMessage(status==="approved"?"Team added to the directory.":"Request rejected.");await load();}}
 return <main className="page-shell"><div className="page-container"><header className="topbar"><Link href="/admin/directory" className="brand">HOOPCHECK ADMIN</Link><nav className="topnav"><Link href="/admin/directory">Directory</Link><Link href="/admin/users">Users</Link><Link href="/dashboard">Dashboard</Link></nav></header><section className="hero-card"><p className="eyebrow">DIRECTORY REQUESTS</p><h1>Team additions</h1><p className="muted">Review member-submitted professional teams before they enter the global directory.</p></section>{message&&<div className="dashboard-card" style={{marginTop:16}}>{message}</div>}<section style={{display:"grid",gap:14,marginTop:20}}>{rows.length?rows.map(r=><article key={r.id} className="dashboard-card"><p className="eyebrow">{r.status.toUpperCase()}</p><h2>{r.team_name}</h2><p className="muted">{r.city? r.city+", ":""}{r.country}{r.league_name?" · "+r.league_name:""}</p><p className="muted" style={{fontSize:12}}>{new Date(r.created_at).toLocaleString()}</p>{r.status==="pending"&&<div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="btn" onClick={()=>review(r.id,"approved")}>Approve & Add</button><button className="btn dark" onClick={()=>review(r.id,"rejected")}>Reject</button></div>}</article>):<div className="dashboard-card"><h2>No requests.</h2><p className="muted">New “Don’t see your team?” submissions will appear here.</p></div>}</section></div></main>;
}