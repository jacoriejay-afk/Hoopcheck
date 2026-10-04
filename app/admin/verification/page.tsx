"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Request = {
  id:string; user_id:string; current_team:string|null; current_country:string|null;
  league:string|null; note:string|null; status:"pending"|"approved"|"rejected";
  reviewer_note:string|null; created_at:string; reviewed_at:string|null;
};
type Profile={id:string;display_name:string|null;player_verified:boolean};

export default function VerificationAdminPage(){
 const [rows,setRows]=useState<Request[]>([]); const [profiles,setProfiles]=useState<Record<string,Profile>>({});
 const [filter,setFilter]=useState<"all"|"pending"|"approved"|"rejected">("pending");
 const [loading,setLoading]=useState(true); const [authorized,setAuthorized]=useState(false); const [error,setError]=useState("");
 const [saving,setSaving]=useState<string|null>(null);

 async function load(){
   const {data:role,error:roleError}=await supabase.rpc("is_current_user_admin_or_moderator");
   if(roleError||!role){setAuthorized(false);setLoading(false);return;}
   setAuthorized(true);
   const {data,error}=await supabase.from("player_verification_requests").select("*").order("created_at",{ascending:false});
   if(error){setError(error.message);setLoading(false);return;}
   setRows((data??[]) as Request[]);
   const ids=(data??[]).map((x:any)=>x.user_id);
   if(ids.length){const {data:p}=await supabase.from("profiles").select("id,display_name,player_verified").in("id",ids);const map:Record<string,Profile>={};for(const x of p??[])map[x.id]=x;setProfiles(map);}
   setLoading(false);
 }
 useEffect(()=>{(async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session){window.location.href="/login";return;}await load();})();},[]);

 async function moderate(row:Request,status:"approved"|"rejected"){
   setSaving(row.id);setError("");
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){setError("Session expired.");setSaving(null);return;}
   const {error:e}=await supabase.rpc("moderate_player_verification",{
     p_request_id:row.id,
     p_status:status,
   });
   if(e){setError(e.message);setSaving(null);return;}
   setRows(current=>current.map(x=>x.id===row.id?{...x,status,reviewed_at:new Date().toISOString()}:x));
   setProfiles(current=>({...current,[row.user_id]:{...current[row.user_id],player_verified:status==="approved"}}));
   setSaving(null);
 }
 const visible=rows.filter(x=>filter==="all"||x.status===filter);
 if(loading)return <main className="page-shell"><div className="page-container"><p>Loading verification center...</p></div></main>;
 if(!authorized)return <main className="page-shell"><div className="page-container"><h1>Access denied</h1><Link href="/dashboard" className="btn">Back to Dashboard</Link></div></main>;
 return <main className="page-shell"><div className="page-container">
  <header className="topbar"><Link href="/" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/admin">Admin</Link><Link href="/account">Account</Link></nav></header>
  <section className="hero-card"><p className="eyebrow">ADMIN · PLAYER VERIFICATION</p><h1>Verify professional players.</h1><p className="muted">Review requests and control who receives the Verified Player badge.</p></section>
  <section className="dashboard-card" style={{marginTop:24}}>
   <select className="input" value={filter} onChange={e=>setFilter(e.target.value as any)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select>
   {error&&<p role="alert">{error}</p>}
  </section>
  <section style={{display:"grid",gap:16,marginTop:20}}>
   {!visible.length?<div className="dashboard-card"><h2>No requests</h2><p className="muted">Nothing matches this filter.</p></div>:
   visible.map(row=><article className="dashboard-card" key={row.id}>
    <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}><div><p className="eyebrow">REQUEST</p><h2>{profiles[row.user_id]?.display_name||"Unnamed player"}</h2></div><strong>{row.status.toUpperCase()}</strong></div>
    <p className="muted">Team: {row.current_team||"Not provided"} · Country: {row.current_country||"Not provided"} · League: {row.league||"Not provided"}</p>
    {row.note&&<p>{row.note}</p>}<p className="muted">{new Date(row.created_at).toLocaleString()}</p>
    {row.status==="pending"&&<div style={{display:"flex",gap:12}}><button className="btn" disabled={saving===row.id} onClick={()=>moderate(row,"approved")}>{saving===row.id?"Saving...":"Approve"}</button><button className="btn dark" disabled={saving===row.id} onClick={()=>moderate(row,"rejected")}>Reject</button></div>}
   </article>)}
  </section>
 </div></main>;
}