"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../../lib/supabase";

type Ticket={id:string;requester_id:string;subject:string;category:string;priority:string;status:string;description:string;created_at:string};

export default function AdminSupport(){
 const [tickets,setTickets]=useState<Ticket[]>([]);const [message,setMessage]=useState("");const [loading,setLoading]=useState(true);
 async function load(){setLoading(true);const {data:ok}=await supabase.rpc("is_current_user_admin_or_moderator");if(!ok){location.href="/dashboard";return;}const {data,error}=await supabase.from("support_tickets").select("id,requester_id,subject,category,priority,status,description,created_at").order("created_at",{ascending:false}).limit(300);if(error)setMessage(error.message);else setTickets((data||[]) as Ticket[]);setLoading(false);}
 useEffect(()=>{void load();},[]);
 async function update(id:string,status:string){const {error}=await supabase.from("support_tickets").update({status,updated_at:new Date().toISOString(),resolved_at:status==="resolved"||status==="closed"?new Date().toISOString():null}).eq("id",id);if(error)setMessage(error.message);else await load();}
 return <main className="page-shell"><div className="page-container">
  <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK ADMIN</Link><nav className="topnav"><Link href="/admin/analytics">Analytics</Link><Link href="/admin/users">Users</Link><Link href="/admin/reviews">Reviews</Link></nav></header>
  <section className="hero-card"><p className="eyebrow">FOUNDER SUPPORT</p><h1>Support ticket queue.</h1><p className="muted">Operational support queue for <a href="mailto:HoopCheck@outlook.com">HoopCheck@outlook.com</a>.</p></section>
  {message&&<div className="message error" style={{marginTop:18}}>{message}</div>}
  {loading?<div className="dashboard-card" style={{marginTop:18}}>Loading tickets...</div>:<section className="grid" style={{marginTop:18}}>{tickets.map(t=><article className="dashboard-card" key={t.id}><div className="eyebrow">{t.status} · {t.priority}</div><h2>{t.subject}</h2><p className="muted">{t.category} · {new Date(t.created_at).toLocaleString()}</p><p>{t.description}</p><p className="muted" style={{fontSize:12}}>Requester: {t.requester_id}</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["in_progress","waiting_on_user","resolved","closed"].map(s=><button key={s} className="btn dark" onClick={()=>update(t.id,s)}>{s.replace("_"," ")}</button>)}</div></article>)}{!tickets.length&&<div className="dashboard-card"><h2>No tickets.</h2></div>}</section>}
 </div></main>;
}
