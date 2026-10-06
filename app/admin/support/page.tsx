"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../../lib/supabase";

type Support={id:string;user_id:string|null;subject:string;body:string;status:string;created_at:string};
type Inquiry={id:string;user_id:string|null;type:"sponsor"|"donate"|"inquire";message:string;status:string;created_at:string};
type Profile={id:string;display_name:string|null;email?:string|null;account_type:string|null};

export default function AdminSupport(){
 const [tab,setTab]=useState<"help"|"inquiries"|"donations">("help");
 const [help,setHelp]=useState<Support[]>([]); const [inquiries,setInquiries]=useState<Inquiry[]>([]);
 const [profiles,setProfiles]=useState<Record<string,Profile>>({}); const [loading,setLoading]=useState(true); const [message,setMessage]=useState("");
 async function load(){
  setLoading(true);
  const {data:ok}=await supabase.rpc("is_current_user_admin_or_moderator");
  if(!ok){location.href="/dashboard";return;}
  const [{data:h,error:he},{data:i,error:ie}]=await Promise.all([
   supabase.from("support_requests").select("id,user_id,subject,body,status,created_at").order("created_at",{ascending:false}).limit(300),
   supabase.from("sponsor_inquiries").select("id,user_id,type,message,status,created_at").order("created_at",{ascending:false}).limit(300)
  ]);
  if(he||ie){setMessage(he?.message||ie?.message||"Unable to load inbox.");setLoading(false);return;}
  setHelp((h||[]) as Support[]);setInquiries((i||[]) as Inquiry[]);
  const ids=Array.from(new Set([...(h||[]).map(x=>x.user_id),...(i||[]).map(x=>x.user_id)].filter(Boolean) as string[]));
  if(ids.length){const {data:p}=await supabase.from("profiles").select("id,display_name,account_type").in("id",ids);const m:Record<string,Profile>={};for(const x of p||[])m[x.id]=x;setProfiles(m);}
  setLoading(false);
 }
 useEffect(()=>{void load()},[]);
 async function updateStatus(kind:"help"|"inquiry",id:string,status:string){
  setMessage("");
  const table=kind==="help"?"support_requests":"sponsor_inquiries";
  const {error}=await supabase.from(table).update({status,updated_at:new Date().toISOString()}).eq("id",id);
  if(error){setMessage(error.message);return;} await load();
 }
 const rows=tab==="help"?help:inquiries.filter(x=>tab==="donations"?x.type==="donate":x.type!=="donate"&&x.type!=="inquire"?false:true);
 const visible=tab==="inquiries"?inquiries.filter(x=>x.type==="sponsor"||x.type==="inquire"):tab==="donations"?inquiries.filter(x=>x.type==="donate"):help;
 return <main className="page-shell"><div className="page-container admin-inbox-page">
  <header className="topbar"><Link href="/admin/directory" className="brand">HOOPCHECK ADMIN</Link><nav className="topnav"><Link href="/admin/users">Users</Link><Link href="/admin/reviews">Reviews</Link><Link href="/admin/verification">Verification</Link><Link href="/dashboard">Dashboard</Link></nav></header>
  <section className="hero-card"><p className="eyebrow">ADMIN · COMMUNITY INBOX</p><h1>Help, inquiries & donations.</h1><p className="muted">One clean place to review support requests, partnership inquiries, and donation requests from HoopCheck members.</p></section>
  <div className="admin-inbox-tabs">
   {([["help","Help"],["inquiries","Inquiries"],["donations","Donations"]] as const).map(([v,l])=><button key={v} onClick={()=>setTab(v)} className={tab===v?"active":""}>{l}<span>{v==="help"?help.length:v==="donations"?inquiries.filter(x=>x.type==="donate").length:inquiries.filter(x=>x.type==="sponsor"||x.type==="inquire").length}</span></button>)}
  </div>
  {message&&<div className="message error">{message}</div>}
  {loading?<div className="dashboard-card"><p>Loading inbox...</p></div>:<section className="admin-inbox-list">
   {visible.map(item=>{
    const isHelp="subject" in item; const p=profiles[item.user_id||""]; const type=isHelp?"Help request":item.type==="donate"?"Donation":"Inquiry";
    return <article className="dashboard-card admin-inbox-card" key={item.id}>
      <div className="admin-inbox-card-head"><div><span className="card-kicker">{type}</span><h2>{isHelp?item.subject:item.type==="donate"?"Donation / Support":"New inquiry"}</h2><p className="muted">{p?.display_name||"HoopCheck member"}{p?.account_type?" · "+p.account_type:""} · {new Date(item.created_at).toLocaleString()}</p></div><span className="status-pill">{item.status}</span></div>
      <p style={{whiteSpace:"pre-wrap"}}>{isHelp?item.body:item.message}</p>
      <div className="admin-inbox-actions">
       {["open","in_progress","resolved"].map(s=><button key={s} className={item.status===s?"selected":""} onClick={()=>updateStatus(isHelp?"help":"inquiry",item.id,s)}>{s.replace("_"," ")}</button>)}
      </div>
    </article>
   })}
   {!visible.length&&<div className="dashboard-card"><h2>No {tab} yet.</h2><p className="muted">New requests will appear here automatically.</p></div>}
  </section>}
 </div></main>;
}
